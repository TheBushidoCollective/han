//! Git operations using gitoxide (pure Rust)
//!
//! Provides high-performance git operations without shelling out to git CLI.
//! All operations are read-only and safe for concurrent use.

use gix::bstr::ByteSlice;
use gix::discover::Error as DiscoverError;
use napi_derive::napi;
use std::path::Path;

/// Git repository information
#[napi(object)]
pub struct GitInfo {
    /// Current branch name (None if detached HEAD)
    pub branch: Option<String>,
    /// Remote origin URL
    pub remote: Option<String>,
    /// Repository name extracted from remote
    pub repo_name: Option<String>,
}

/// Git worktree information
#[napi(object)]
pub struct GitWorktree {
    /// Absolute path to the worktree
    pub path: String,
    /// Name of the worktree (basename of path for main, or worktree name)
    pub name: String,
    /// Current branch or commit
    pub head: Option<String>,
    /// Whether this is the main worktree
    pub is_main: bool,
    /// Whether the worktree is locked
    pub is_locked: bool,
}

/// Open a git repository at the given path
fn open_repo(path: &str) -> Result<gix::Repository, Box<DiscoverError>> {
    gix::discover(path).map_err(Box::new)
}

/// Get current git branch for a directory
/// Returns None if not in a git repository or on a detached HEAD
#[napi]
pub fn get_git_branch(directory: String) -> Option<String> {
    let repo = open_repo(&directory).ok()?;
    let head = repo.head().ok()?;

    if head.is_detached() {
        return None;
    }

    head.referent_name().map(|name| name.shorten().to_string())
}

/// Get git repository root (equivalent to `git rev-parse --show-toplevel`)
#[napi]
pub fn get_git_root(directory: String) -> Option<String> {
    let repo = open_repo(&directory).ok()?;
    repo.work_dir()
        .and_then(|p| p.to_str())
        .map(|s| s.to_string())
}

/// Get git common directory (equivalent to `git rev-parse --git-common-dir`)
/// For worktrees, this returns the main .git directory
#[napi]
pub fn get_git_common_dir(directory: String) -> Option<String> {
    let repo = open_repo(&directory).ok()?;
    repo.common_dir().to_str().map(|s| s.to_string())
}

/// Get remote origin URL
#[napi]
pub fn get_git_remote_url(directory: String) -> Option<String> {
    let repo = open_repo(&directory).ok()?;
    let remote = repo.find_remote("origin").ok()?;
    remote
        .url(gix::remote::Direction::Fetch)
        .and_then(|url| url.to_bstring().to_str().ok().map(|s| s.to_string()))
}

/// Get comprehensive git info for a directory
#[napi]
pub fn get_git_info(directory: String) -> GitInfo {
    let path = Path::new(&directory);
    if !path.exists() {
        return GitInfo {
            branch: None,
            remote: None,
            repo_name: None,
        };
    }

    let repo = match open_repo(&directory) {
        Ok(r) => r,
        Err(_) => {
            return GitInfo {
                branch: None,
                remote: None,
                repo_name: None,
            }
        }
    };

    // Get current branch
    let branch = repo.head().ok().and_then(|head| {
        if head.is_detached() {
            None
        } else {
            head.referent_name().map(|name| name.shorten().to_string())
        }
    });

    // Get remote URL
    let remote = repo.find_remote("origin").ok().and_then(|r| {
        r.url(gix::remote::Direction::Fetch)
            .and_then(|url| url.to_bstring().to_str().ok().map(|s| s.to_string()))
    });

    // Extract repo name from remote URL
    let repo_name: Option<String> = remote.as_ref().and_then(|r: &String| {
        r.rsplit('/')
            .next()
            .or_else(|| r.rsplit(':').next())
            .map(|s| s.trim_end_matches(".git").to_string())
    });

    GitInfo {
        branch,
        remote,
        repo_name,
    }
}

/// List tracked files in the repository (equivalent to `git ls-files`)
#[napi]
pub fn git_ls_files(directory: String) -> napi::Result<Vec<String>> {
    let repo = open_repo(&directory)
        .map_err(|e| napi::Error::from_reason(format!("Not a git repository: {}", e)))?;

    let index = repo
        .index()
        .map_err(|e| napi::Error::from_reason(format!("Failed to read index: {}", e)))?;

    let files: Vec<String> = index
        .entries()
        .iter()
        .filter_map(|entry| {
            let path = entry.path(&index);
            path.to_str().ok().map(|s| s.to_string())
        })
        .collect();

    Ok(files)
}

/// List git worktrees (equivalent to `git worktree list --porcelain`)
#[napi]
pub fn git_worktree_list(directory: String) -> napi::Result<Vec<GitWorktree>> {
    let repo = open_repo(&directory)
        .map_err(|e| napi::Error::from_reason(format!("Not a git repository: {}", e)))?;

    let mut worktrees = Vec::new();

    // Add main worktree
    if let Some(work_dir) = repo.work_dir() {
        let path_str = work_dir.to_string_lossy().to_string();
        let name = work_dir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "main".to_string());

        let head = repo.head().ok().and_then(|h| {
            if h.is_detached() {
                h.id().map(|id| id.to_hex().to_string())
            } else {
                h.referent_name().map(|n| n.shorten().to_string())
            }
        });

        worktrees.push(GitWorktree {
            path: path_str,
            name,
            head,
            is_main: true,
            is_locked: false,
        });
    }

    // List linked worktrees from .git/worktrees/
    let git_dir = repo.git_dir();
    let worktrees_dir = git_dir.join("worktrees");

    if worktrees_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&worktrees_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let wt_name = entry.file_name().to_string_lossy().to_string();
                    let wt_git_dir = entry.path();

                    // Read gitdir file to get worktree path
                    let gitdir_file = wt_git_dir.join("gitdir");
                    if let Ok(gitdir_content) = std::fs::read_to_string(&gitdir_file) {
                        let wt_path = Path::new(gitdir_content.trim())
                            .parent()
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_default();

                        // Read HEAD to get current branch/commit
                        let head_file = wt_git_dir.join("HEAD");
                        let head = std::fs::read_to_string(&head_file).ok().map(|content| {
                            let content = content.trim();
                            if content.starts_with("ref: ") {
                                content
                                    .strip_prefix("ref: refs/heads/")
                                    .unwrap_or(content.strip_prefix("ref: ").unwrap_or(content))
                                    .to_string()
                            } else {
                                // Detached HEAD - show short hash
                                content.chars().take(8).collect()
                            }
                        });

                        // Check if locked
                        let is_locked = wt_git_dir.join("locked").exists();

                        worktrees.push(GitWorktree {
                            path: wt_path,
                            name: wt_name,
                            head,
                            is_main: false,
                            is_locked,
                        });
                    }
                }
            }
        }
    }

    Ok(worktrees)
}

/// Get git log entries (equivalent to `git log`)
#[napi(object)]
pub struct GitLogEntry {
    /// Commit hash (full SHA)
    pub hash: String,
    /// Short commit hash (first 8 chars)
    pub short_hash: String,
    /// Commit message (first line)
    pub message: String,
    /// Author name
    pub author_name: String,
    /// Author email
    pub author_email: String,
    /// Commit timestamp (ISO 8601)
    pub timestamp: String,
}

/// Get git log for a directory
#[napi]
pub fn git_log(directory: String, max_count: Option<u32>) -> napi::Result<Vec<GitLogEntry>> {
    let repo = open_repo(&directory)
        .map_err(|e| napi::Error::from_reason(format!("Not a git repository: {}", e)))?;

    let head = repo
        .head()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get HEAD: {}", e)))?;

    let head_id = head
        .id()
        .ok_or_else(|| napi::Error::from_reason("HEAD has no commit"))?;

    let limit = max_count.unwrap_or(100) as usize;
    let mut entries = Vec::with_capacity(limit);

    // Walk commits
    let mut walk = head_id
        .ancestors()
        .first_parent_only()
        .all()
        .map_err(|e| napi::Error::from_reason(format!("Failed to walk commits: {}", e)))?;

    for info in walk.by_ref().take(limit) {
        let info =
            info.map_err(|e| napi::Error::from_reason(format!("Failed to read commit: {}", e)))?;
        let commit = info
            .id()
            .object()
            .map_err(|e| napi::Error::from_reason(format!("Failed to get commit object: {}", e)))?
            .into_commit();

        let hash = info.id().to_hex().to_string();
        let short_hash: String = hash.chars().take(8).collect();

        let message = commit
            .message_raw()
            .map_err(|e| napi::Error::from_reason(format!("Failed to read message: {}", e)))?
            .to_str()
            .ok()
            .map(|s| s.lines().next().unwrap_or("").to_string())
            .unwrap_or_default();

        let author = commit
            .author()
            .map_err(|e| napi::Error::from_reason(format!("Failed to read author: {}", e)))?;

        let author_name = author.name.to_str().ok().unwrap_or("").to_string();
        let author_email = author.email.to_str().ok().unwrap_or("").to_string();

        let timestamp = chrono::DateTime::from_timestamp(author.time.seconds, 0)
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_default();

        entries.push(GitLogEntry {
            hash,
            short_hash,
            message,
            author_name,
            author_email,
            timestamp,
        });
    }

    Ok(entries)
}

/// Get file content at a specific commit (equivalent to `git show <commit>:<path>`)
#[napi]
pub fn git_show_file(directory: String, commit: String, file_path: String) -> napi::Result<String> {
    let repo = open_repo(&directory)
        .map_err(|e| napi::Error::from_reason(format!("Not a git repository: {}", e)))?;

    // Parse commit reference
    let rev = repo
        .rev_parse_single(commit.as_str())
        .map_err(|e| napi::Error::from_reason(format!("Invalid commit reference: {}", e)))?;

    let commit_obj = rev
        .object()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get object: {}", e)))?
        .peel_to_kind(gix::object::Kind::Commit)
        .map_err(|e| napi::Error::from_reason(format!("Not a commit: {}", e)))?
        .into_commit();

    let tree = commit_obj
        .tree()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get tree: {}", e)))?;

    let entry = tree
        .lookup_entry_by_path(file_path.as_str())
        .map_err(|e| napi::Error::from_reason(format!("Failed to lookup path: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("File not found: {}", file_path)))?;

    let blob = entry
        .object()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get blob: {}", e)))?;

    String::from_utf8(blob.data.to_vec())
        .map_err(|e| napi::Error::from_reason(format!("File is not UTF-8: {}", e)))
}

/// Diff statistics for a file
#[napi(object)]
pub struct GitDiffStat {
    /// File path
    pub path: String,
    /// Lines added
    pub additions: u32,
    /// Lines deleted
    pub deletions: u32,
    /// Change type: "added", "deleted", "modified", "renamed"
    pub change_type: String,
    /// Old path (for renames)
    pub old_path: Option<String>,
}

/// Get diff between two commits - simplified version using tree comparison
/// Returns list of changed files without line counts (for now)
#[napi]
pub fn git_diff_stat(
    directory: String,
    from_commit: String,
    to_commit: String,
) -> napi::Result<Vec<GitDiffStat>> {
    let repo = open_repo(&directory)
        .map_err(|e| napi::Error::from_reason(format!("Not a git repository: {}", e)))?;

    // Parse commit references
    let from_rev = repo
        .rev_parse_single(from_commit.as_str())
        .map_err(|e| napi::Error::from_reason(format!("Invalid from commit: {}", e)))?;
    let to_rev = repo
        .rev_parse_single(to_commit.as_str())
        .map_err(|e| napi::Error::from_reason(format!("Invalid to commit: {}", e)))?;

    let from_tree = from_rev
        .object()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get from object: {}", e)))?
        .peel_to_kind(gix::object::Kind::Commit)
        .map_err(|e| napi::Error::from_reason(format!("From is not a commit: {}", e)))?
        .into_commit()
        .tree()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get from tree: {}", e)))?;

    let to_tree = to_rev
        .object()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get to object: {}", e)))?
        .peel_to_kind(gix::object::Kind::Commit)
        .map_err(|e| napi::Error::from_reason(format!("To is not a commit: {}", e)))?
        .into_commit()
        .tree()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get to tree: {}", e)))?;

    // Use tree changes for diff - collect paths from both trees and compare
    let mut stats = Vec::new();
    let mut from_paths = std::collections::HashSet::new();
    let mut to_paths = std::collections::HashMap::new();

    // Helper to recursively collect blob paths from a tree
    fn collect_blob_paths(
        _repo: &gix::Repository,
        tree: &gix::Tree,
        prefix: &str,
        paths: &mut std::collections::HashSet<String>,
    ) -> Result<(), napi::Error> {
        for entry in tree.iter() {
            let entry = entry
                .map_err(|e| napi::Error::from_reason(format!("Failed to read entry: {}", e)))?;
            let name = entry
                .filename()
                .to_str()
                .ok()
                .ok_or_else(|| napi::Error::from_reason("Invalid UTF-8 in filename"))?;
            let path = if prefix.is_empty() {
                name.to_string()
            } else {
                format!("{}/{}", prefix, name)
            };

            if entry.mode().is_blob() {
                paths.insert(path);
            } else if entry.mode().is_tree() {
                let subtree = entry
                    .object()
                    .map_err(|e| napi::Error::from_reason(format!("Failed to get subtree: {}", e)))?
                    .into_tree();
                collect_blob_paths(_repo, &subtree, &path, paths)?;
            }
        }
        Ok(())
    }

    // Collect paths from from_tree
    collect_blob_paths(&repo, &from_tree, "", &mut from_paths)?;

    // Collect paths from to_tree (with oids for comparison)
    fn collect_blob_paths_with_oids(
        _repo: &gix::Repository,
        tree: &gix::Tree,
        prefix: &str,
        paths: &mut std::collections::HashMap<String, gix::ObjectId>,
    ) -> Result<(), napi::Error> {
        for entry in tree.iter() {
            let entry = entry
                .map_err(|e| napi::Error::from_reason(format!("Failed to read entry: {}", e)))?;
            let name = entry
                .filename()
                .to_str()
                .ok()
                .ok_or_else(|| napi::Error::from_reason("Invalid UTF-8 in filename"))?;
            let path = if prefix.is_empty() {
                name.to_string()
            } else {
                format!("{}/{}", prefix, name)
            };

            if entry.mode().is_blob() {
                paths.insert(path, entry.oid().to_owned());
            } else if entry.mode().is_tree() {
                let subtree = entry
                    .object()
                    .map_err(|e| napi::Error::from_reason(format!("Failed to get subtree: {}", e)))?
                    .into_tree();
                collect_blob_paths_with_oids(_repo, &subtree, &path, paths)?;
            }
        }
        Ok(())
    }

    collect_blob_paths_with_oids(&repo, &to_tree, "", &mut to_paths)?;

    // Find additions (in to_tree but not in from_tree)
    for path in to_paths.keys() {
        if !from_paths.contains(path) {
            stats.push(GitDiffStat {
                path: path.clone(),
                additions: 0,
                deletions: 0,
                change_type: "added".to_string(),
                old_path: None,
            });
        }
    }

    // Find deletions (in from_tree but not in to_tree)
    for path in &from_paths {
        if !to_paths.contains_key(path) {
            stats.push(GitDiffStat {
                path: path.clone(),
                additions: 0,
                deletions: 0,
                change_type: "deleted".to_string(),
                old_path: None,
            });
        }
    }

    // For modifications, we'd need to compare content - skip for now
    // This is a simplified diff that only shows added/deleted files

    Ok(stats)
}
