#![deny(clippy::all)]

use ignore::WalkBuilder;
use napi_derive::napi;
use rayon::prelude::*;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::Path;

/// Compute SHA256 hash of a file's contents
/// Returns empty string if file cannot be read
#[napi]
pub fn compute_file_hash(file_path: String) -> String {
    match fs::File::open(&file_path) {
        Ok(mut file) => {
            let mut hasher = Sha256::new();
            let mut buffer = [0u8; 8192];
            loop {
                match file.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(n) => hasher.update(&buffer[..n]),
                    Err(_) => return String::new(),
                }
            }
            format!("{:x}", hasher.finalize())
        }
        Err(_) => String::new(),
    }
}

/// Compute SHA256 hashes for multiple files in parallel
/// Returns a map of file path to hash
#[napi]
pub fn compute_file_hashes_parallel(file_paths: Vec<String>) -> HashMap<String, String> {
    file_paths
        .par_iter()
        .map(|path| {
            let hash = compute_file_hash(path.clone());
            (path.clone(), hash)
        })
        .collect()
}

/// Find files matching glob patterns in a directory, respecting gitignore
/// Returns absolute file paths
#[napi]
pub fn find_files_with_glob(root_dir: String, patterns: Vec<String>) -> Vec<String> {
    // Canonicalize the root path to get absolute path
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    // Build glob matchers
    let mut glob_builder = globset::GlobSetBuilder::new();
    for pattern in &patterns {
        if let Ok(glob) = globset::Glob::new(pattern) {
            glob_builder.add(glob);
        }
    }
    let glob_set = match glob_builder.build() {
        Ok(gs) => gs,
        Err(_) => return Vec::new(),
    };

    let mut results = Vec::new();

    // Walk directory respecting gitignore
    // Note: hidden(true) skips hidden files/dirs to match globby default behavior
    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(|entry| {
            // Skip .git directory
            entry.file_name() != ".git"
        })
        .build();

    for entry in walker.flatten() {
        if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            let path = entry.path();
            // Get path relative to root for glob matching
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy();
                if glob_set.is_match(relative_str.as_ref()) {
                    // Canonicalize the full path for consistent absolute paths
                    if let Ok(abs_path) = fs::canonicalize(path) {
                        if let Some(abs_str) = abs_path.to_str() {
                            results.push(abs_str.to_string());
                        }
                    }
                }
            }
        }
    }

    results
}

/// macOS bundle directory extensions that should not be descended into or returned as targets
const BUNDLE_EXTENSIONS: &[&str] = &[
    ".xcodeproj",
    ".xcworkspace",
    ".xcassets",
    ".app",
    ".framework",
    ".bundle",
    ".playground",
    ".xctest",
];

/// Check if a path component is a bundle directory
fn is_bundle_dir(name: &str) -> bool {
    BUNDLE_EXTENSIONS.iter().any(|ext| name.ends_with(ext))
}

/// Check if any path component is inside a bundle directory
fn is_inside_bundle(path: &Path) -> bool {
    for component in path.components() {
        if let std::path::Component::Normal(name) = component {
            let name_str = name.to_string_lossy();
            if is_bundle_dir(&name_str) {
                return true;
            }
        }
    }
    false
}

/// Find directories containing marker files or directories (e.g., mix.exs, Cargo.toml, *.xcodeproj)
/// Returns absolute directory paths
#[napi]
pub fn find_directories_with_markers(root_dir: String, markers: Vec<String>) -> Vec<String> {
    // Canonicalize the root path to get absolute path
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    // Build glob matchers for markers
    let mut glob_builder = globset::GlobSetBuilder::new();
    for marker in &markers {
        // Add pattern for root level (e.g., "mix.exs", "*.xcodeproj")
        if let Ok(glob) = globset::Glob::new(marker) {
            glob_builder.add(glob);
        }
        // Add pattern for nested levels (e.g., "**/mix.exs", "**/*.xcodeproj")
        let nested_pattern = format!("**/{}", marker);
        if let Ok(glob) = globset::Glob::new(&nested_pattern) {
            glob_builder.add(glob);
        }
    }
    let glob_set = match glob_builder.build() {
        Ok(gs) => gs,
        Err(_) => return Vec::new(),
    };

    let mut seen_dirs = std::collections::HashSet::new();
    let mut results = Vec::new();

    // Clone root for use in filter closure
    let filter_root = root.clone();

    // Walk directory respecting gitignore
    // Note: hidden(true) skips hidden files/dirs to match globby default behavior
    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(move |entry| {
            let name = entry.file_name().to_string_lossy();
            // Skip .git
            if name == ".git" {
                return false;
            }
            // Skip descending into bundle directories (but we'll still match them at entry level)
            // Note: filter_entry returning false skips both the entry AND its subtree
            // We handle bundle matching specially below
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                // Check if we're INSIDE a bundle already (relative path contains a bundle)
                if let Ok(rel) = entry.path().strip_prefix(&filter_root) {
                    // If any parent component is a bundle, skip this entry entirely
                    let rel_str = rel.to_string_lossy();
                    for component in rel_str.split('/') {
                        // Skip empty components and the current entry itself
                        if component.is_empty() || component == name {
                            continue;
                        }
                        if is_bundle_dir(component) {
                            return false;
                        }
                    }
                }
            }
            true
        })
        .build();

    for entry in walker.flatten() {
        let file_type = entry.file_type();
        let is_file = file_type.map(|ft| ft.is_file()).unwrap_or(false);
        let is_dir = file_type.map(|ft| ft.is_dir()).unwrap_or(false);

        // Match both files and directories (for bundle dirs like *.xcodeproj, *.xcworkspace)
        if is_file || is_dir {
            let path = entry.path();
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy();
                if glob_set.is_match(relative_str.as_ref()) {
                    // For files, use parent directory; for directories, use the directory itself's parent
                    let target_dir = if is_file {
                        path.parent()
                    } else {
                        // For directory markers (like *.xcodeproj), the parent is the project dir
                        path.parent()
                    };

                    if let Some(parent) = target_dir {
                        // Canonicalize the directory path
                        if let Ok(abs_dir) = fs::canonicalize(parent) {
                            // Ensure the target directory is not inside a bundle
                            if let Ok(rel_target) = abs_dir.strip_prefix(&root) {
                                if is_inside_bundle(rel_target) {
                                    continue;
                                }
                            }

                            if let Some(dir_str) = abs_dir.to_str() {
                                // Also ensure the directory itself is not a bundle
                                let dir_name = abs_dir.file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_default();
                                if is_bundle_dir(&dir_name) {
                                    continue;
                                }

                                if seen_dirs.insert(dir_str.to_string()) {
                                    results.push(dir_str.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    results
}

/// Build a manifest of file hashes for given files
/// Returns a map of relative path to hash
#[napi]
pub fn build_manifest(files: Vec<String>, root_dir: String) -> HashMap<String, String> {
    // Canonicalize the root path to get absolute path
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => Path::new(&root_dir).to_path_buf(),
    };

    files
        .par_iter()
        .filter_map(|file| {
            let path = Path::new(file);
            let relative = path.strip_prefix(&root).ok()?;
            let relative_str = relative.to_string_lossy().to_string();
            let hash = compute_file_hash(file.clone());
            Some((relative_str, hash))
        })
        .collect()
}

/// Check if any files have changed compared to a cached manifest
/// Returns true if changes detected, false if no changes
/// Uses streaming with early exit on first change
#[napi]
pub fn has_changes(
    root_dir: String,
    patterns: Vec<String>,
    cached_manifest: HashMap<String, String>,
) -> bool {
    if cached_manifest.is_empty() {
        return true;
    }

    // Canonicalize the root path to get absolute path
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => return true,
    };

    // Build glob matchers
    let mut glob_builder = globset::GlobSetBuilder::new();
    for pattern in &patterns {
        if let Ok(glob) = globset::Glob::new(pattern) {
            glob_builder.add(glob);
        }
    }
    let glob_set = match glob_builder.build() {
        Ok(gs) => gs,
        Err(_) => return true,
    };

    let mut seen_paths = std::collections::HashSet::new();

    // Walk directory respecting gitignore
    // Note: hidden(true) skips hidden files/dirs to match globby default behavior
    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(|entry| {
            entry.file_name() != ".git"
        })
        .build();

    for entry in walker.flatten() {
        if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            let path = entry.path();
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy().to_string();
                if glob_set.is_match(&relative_str) {
                    seen_paths.insert(relative_str.clone());

                    // Compute current hash
                    let current_hash = if let Some(abs_path) = path.to_str() {
                        compute_file_hash(abs_path.to_string())
                    } else {
                        String::new()
                    };

                    // Check against cached hash
                    let cached_hash = cached_manifest.get(&relative_str);
                    if cached_hash.map(|h| h.as_str()) != Some(&current_hash) {
                        // File is new or modified - exit immediately
                        return true;
                    }
                }
            }
        }
    }

    // Check for deleted files (files in cache but not found)
    for cached_path in cached_manifest.keys() {
        if !seen_paths.contains(cached_path) {
            return true;
        }
    }

    false
}

/// Combined function: find files, build manifest, and optionally check for changes
/// Returns (has_changes: bool, manifest: HashMap) for efficiency
#[napi(object)]
pub struct CheckResult {
    pub has_changes: bool,
    pub manifest: HashMap<String, String>,
    pub files: Vec<String>,
}

/// Efficiently check for changes and build manifest in one pass
#[napi]
pub fn check_and_build_manifest(
    root_dir: String,
    patterns: Vec<String>,
    cached_manifest: Option<HashMap<String, String>>,
) -> CheckResult {
    // Canonicalize the root path to get absolute path
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => {
            return CheckResult {
                has_changes: true,
                manifest: HashMap::new(),
                files: Vec::new(),
            }
        }
    };

    // Build glob matchers
    let mut glob_builder = globset::GlobSetBuilder::new();
    for pattern in &patterns {
        if let Ok(glob) = globset::Glob::new(pattern) {
            glob_builder.add(glob);
        }
    }
    let glob_set = match glob_builder.build() {
        Ok(gs) => gs,
        Err(_) => {
            return CheckResult {
                has_changes: true,
                manifest: HashMap::new(),
                files: Vec::new(),
            }
        }
    };

    let cache = cached_manifest.unwrap_or_default();
    let has_cache = !cache.is_empty();
    let mut files = Vec::new();

    // Walk directory respecting gitignore and collect files
    // Note: hidden(true) skips hidden files/dirs to match globby default behavior
    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(|entry| {
            entry.file_name() != ".git"
        })
        .build();

    for entry in walker.flatten() {
        if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            let path = entry.path();
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy().to_string();
                if glob_set.is_match(&relative_str) {
                    if let Some(abs_path) = path.to_str() {
                        files.push(abs_path.to_string());
                    }
                }
            }
        }
    }

    // Build manifest in parallel
    let manifest: HashMap<String, String> = files
        .par_iter()
        .filter_map(|file| {
            let path = Path::new(file);
            let relative = path.strip_prefix(&root).ok()?;
            let relative_str = relative.to_string_lossy().to_string();
            let hash = compute_file_hash(file.clone());
            Some((relative_str, hash))
        })
        .collect();

    // Determine if changes occurred
    let has_changes = if !has_cache {
        true
    } else {
        // Check for new or modified files
        let mut changed = false;
        for (path, hash) in &manifest {
            if cache.get(path) != Some(hash) {
                changed = true;
                break;
            }
        }
        // Check for deleted files
        if !changed {
            for cached_path in cache.keys() {
                if !manifest.contains_key(cached_path) {
                    changed = true;
                    break;
                }
            }
        }
        changed
    };

    CheckResult {
        has_changes,
        manifest,
        files,
    }
}
