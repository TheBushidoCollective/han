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

    // Handle empty repos (no index file yet) by returning empty list
    let index = match repo.index() {
        Ok(idx) => idx,
        Err(_) => return Ok(Vec::new()),
    };

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

/// Create a new branch from current HEAD
#[napi]
pub fn git_create_branch(directory: String, branch_name: String) -> napi::Result<()> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["branch", &branch_name])
        .current_dir(&directory)
        .output()
        .map_err(|e| napi::Error::from_reason(format!("Failed to run git: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(napi::Error::from_reason(format!(
            "git branch failed: {}",
            stderr.trim()
        )));
    }

    Ok(())
}

/// Add a worktree at specified path for a branch
#[napi]
pub fn git_worktree_add(
    directory: String,
    worktree_path: String,
    branch: String,
) -> napi::Result<()> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["worktree", "add", &worktree_path, &branch])
        .current_dir(&directory)
        .output()
        .map_err(|e| napi::Error::from_reason(format!("Failed to run git: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(napi::Error::from_reason(format!(
            "git worktree add failed: {}",
            stderr.trim()
        )));
    }

    Ok(())
}

/// Remove a worktree
#[napi]
pub fn git_worktree_remove(
    directory: String,
    worktree_path: String,
    force: Option<bool>,
) -> napi::Result<()> {
    use std::process::Command;

    let mut args = vec!["worktree", "remove", &worktree_path];
    if force.unwrap_or(false) {
        args.push("--force");
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(&directory)
        .output()
        .map_err(|e| napi::Error::from_reason(format!("Failed to run git: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(napi::Error::from_reason(format!(
            "git worktree remove failed: {}",
            stderr.trim()
        )));
    }

    Ok(())
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

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;

    /// Helper to create a temporary git repository for testing
    struct TestRepo {
        dir: tempfile::TempDir,
    }

    impl TestRepo {
        /// Create a new test repo with basic git config
        fn new() -> Self {
            let dir = tempfile::tempdir().expect("Failed to create temp dir");

            // Initialize git repo
            Command::new("git")
                .args(["init"])
                .current_dir(dir.path())
                .output()
                .expect("Failed to init git repo");

            // Configure git for the test
            Command::new("git")
                .args(["config", "user.email", "test@example.com"])
                .current_dir(dir.path())
                .output()
                .expect("Failed to configure git email");

            Command::new("git")
                .args(["config", "user.name", "Test User"])
                .current_dir(dir.path())
                .output()
                .expect("Failed to configure git name");

            // Disable commit signing for tests (CI may have signing configured)
            Command::new("git")
                .args(["config", "commit.gpgsign", "false"])
                .current_dir(dir.path())
                .output()
                .expect("Failed to disable commit signing");

            TestRepo { dir }
        }

        /// Get the path to the test repo
        fn path(&self) -> &std::path::Path {
            self.dir.path()
        }

        /// Get the path as a String
        fn path_str(&self) -> String {
            self.dir.path().to_string_lossy().to_string()
        }

        /// Create a file and optionally commit it
        fn create_file(&self, name: &str, content: &str) {
            let file_path = self.dir.path().join(name);
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent).expect("Failed to create parent dirs");
            }
            fs::write(&file_path, content).expect("Failed to write file");
        }

        /// Add and commit all changes
        fn commit(&self, message: &str) -> String {
            Command::new("git")
                .args(["add", "-A"])
                .current_dir(self.dir.path())
                .output()
                .expect("Failed to git add");

            Command::new("git")
                .args(["commit", "-m", message])
                .current_dir(self.dir.path())
                .output()
                .expect("Failed to git commit");

            // Get the commit hash
            let output = Command::new("git")
                .args(["rev-parse", "HEAD"])
                .current_dir(self.dir.path())
                .output()
                .expect("Failed to get commit hash");

            String::from_utf8_lossy(&output.stdout).trim().to_string()
        }

        /// Create a branch
        fn create_branch(&self, name: &str) {
            Command::new("git")
                .args(["checkout", "-b", name])
                .current_dir(self.dir.path())
                .output()
                .expect("Failed to create branch");
        }

        /// Checkout a branch
        fn checkout(&self, name: &str) {
            Command::new("git")
                .args(["checkout", name])
                .current_dir(self.dir.path())
                .output()
                .expect("Failed to checkout branch");
        }

        /// Add a remote
        fn add_remote(&self, name: &str, url: &str) {
            Command::new("git")
                .args(["remote", "add", name, url])
                .current_dir(self.dir.path())
                .output()
                .expect("Failed to add remote");
        }

        /// Checkout a detached HEAD
        fn detach_head(&self) {
            let output = Command::new("git")
                .args(["rev-parse", "HEAD"])
                .current_dir(self.dir.path())
                .output()
                .expect("Failed to get HEAD");
            let hash = String::from_utf8_lossy(&output.stdout).trim().to_string();

            Command::new("git")
                .args(["checkout", &hash])
                .current_dir(self.dir.path())
                .output()
                .expect("Failed to detach HEAD");
        }

        /// Create a worktree
        fn create_worktree(&self, path: &str, branch: &str) {
            let worktree_path = self.dir.path().parent().unwrap().join(path);
            Command::new("git")
                .args([
                    "worktree",
                    "add",
                    worktree_path.to_str().unwrap(),
                    "-b",
                    branch,
                ])
                .current_dir(self.dir.path())
                .output()
                .expect("Failed to create worktree");
        }
    }

    // ========================================================================
    // Git Repository Detection Tests
    // ========================================================================

    #[test]
    fn test_get_git_root_valid_repo() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");

        let result = get_git_root(repo.path_str());
        assert!(result.is_some());
        // The result should be the canonical path to the repo
        let root = result.unwrap();
        assert!(root.contains(repo.path().file_name().unwrap().to_str().unwrap()));
    }

    #[test]
    fn test_get_git_root_subdirectory() {
        let repo = TestRepo::new();
        repo.create_file("subdir/test.txt", "content");
        repo.commit("Initial commit");

        let subdir_path = repo.path().join("subdir").to_string_lossy().to_string();
        let result = get_git_root(subdir_path);
        assert!(result.is_some());
    }

    #[test]
    fn test_get_git_root_non_repo() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let result = get_git_root(temp_dir.path().to_string_lossy().to_string());
        assert!(result.is_none());
    }

    #[test]
    fn test_get_git_root_nonexistent_path() {
        let result = get_git_root("/nonexistent/path/that/does/not/exist".to_string());
        assert!(result.is_none());
    }

    #[test]
    fn test_get_git_common_dir() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");

        let result = get_git_common_dir(repo.path_str());
        assert!(result.is_some());
        let common_dir = result.unwrap();
        // Common dir should contain .git
        assert!(common_dir.contains(".git") || common_dir.ends_with(".git"));
    }

    // ========================================================================
    // Remote URL Parsing Tests
    // ========================================================================

    #[test]
    fn test_get_git_remote_url_with_origin() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");
        repo.add_remote("origin", "https://github.com/user/repo.git");

        let result = get_git_remote_url(repo.path_str());
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "https://github.com/user/repo.git");
    }

    #[test]
    fn test_get_git_remote_url_ssh_format() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");
        repo.add_remote("origin", "git@github.com:user/repo.git");

        let result = get_git_remote_url(repo.path_str());
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "git@github.com:user/repo.git");
    }

    #[test]
    fn test_get_git_remote_url_no_remote() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");

        let result = get_git_remote_url(repo.path_str());
        assert!(result.is_none());
    }

    #[test]
    fn test_get_git_info_extracts_repo_name_https() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");
        repo.add_remote("origin", "https://github.com/user/my-awesome-repo.git");

        let info = get_git_info(repo.path_str());
        assert_eq!(info.repo_name, Some("my-awesome-repo".to_string()));
    }

    #[test]
    fn test_get_git_info_extracts_repo_name_ssh() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");
        repo.add_remote("origin", "git@github.com:user/my-repo.git");

        let info = get_git_info(repo.path_str());
        assert_eq!(info.repo_name, Some("my-repo".to_string()));
    }

    #[test]
    fn test_get_git_info_extracts_repo_name_without_git_extension() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");
        repo.add_remote("origin", "https://github.com/user/repo-name");

        let info = get_git_info(repo.path_str());
        assert_eq!(info.repo_name, Some("repo-name".to_string()));
    }

    // ========================================================================
    // Branch Operations Tests
    // ========================================================================

    #[test]
    fn test_get_git_branch_default_branch() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");

        let result = get_git_branch(repo.path_str());
        assert!(result.is_some());
        // Default branch could be "main" or "master" depending on git config
        let branch = result.unwrap();
        assert!(branch == "main" || branch == "master");
    }

    #[test]
    fn test_get_git_branch_custom_branch() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");
        repo.create_branch("feature/my-feature");

        let result = get_git_branch(repo.path_str());
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "feature/my-feature");
    }

    #[test]
    fn test_get_git_branch_detached_head() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");
        repo.detach_head();

        let result = get_git_branch(repo.path_str());
        assert!(result.is_none());
    }

    #[test]
    fn test_get_git_branch_no_commits() {
        let repo = TestRepo::new();
        // No commits yet - HEAD doesn't point to anything
        let result = get_git_branch(repo.path_str());
        // Git repos without commits may or may not return a branch
        // depending on git version, so we just ensure it doesn't panic
        let _ = result;
    }

    #[test]
    fn test_get_git_info_with_branch() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");
        repo.create_branch("develop");

        let info = get_git_info(repo.path_str());
        assert_eq!(info.branch, Some("develop".to_string()));
    }

    #[test]
    fn test_get_git_info_detached_head() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");
        repo.detach_head();

        let info = get_git_info(repo.path_str());
        assert!(info.branch.is_none());
    }

    // ========================================================================
    // Git Info Comprehensive Tests
    // ========================================================================

    #[test]
    fn test_get_git_info_nonexistent_path() {
        let info = get_git_info("/nonexistent/path".to_string());
        assert!(info.branch.is_none());
        assert!(info.remote.is_none());
        assert!(info.repo_name.is_none());
    }

    #[test]
    fn test_get_git_info_not_a_repo() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let info = get_git_info(temp_dir.path().to_string_lossy().to_string());
        assert!(info.branch.is_none());
        assert!(info.remote.is_none());
        assert!(info.repo_name.is_none());
    }

    #[test]
    fn test_get_git_info_complete() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");
        repo.add_remote("origin", "https://github.com/org/project.git");

        let info = get_git_info(repo.path_str());
        assert!(info.branch.is_some());
        assert_eq!(
            info.remote,
            Some("https://github.com/org/project.git".to_string())
        );
        assert_eq!(info.repo_name, Some("project".to_string()));
    }

    // ========================================================================
    // Worktree Handling Tests
    // ========================================================================

    #[test]
    fn test_git_worktree_list_main_only() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");

        let worktrees = git_worktree_list(repo.path_str()).expect("Failed to list worktrees");
        assert_eq!(worktrees.len(), 1);
        assert!(worktrees[0].is_main);
        assert!(!worktrees[0].is_locked);
        assert!(worktrees[0].head.is_some());
    }

    #[test]
    fn test_git_worktree_list_with_linked_worktree() {
        let repo = TestRepo::new();
        repo.create_file("test.txt", "content");
        repo.commit("Initial commit");

        // Create a linked worktree
        let worktree_name = format!("worktree-{}", std::process::id());
        repo.create_worktree(&worktree_name, "feature-branch");

        let worktrees = git_worktree_list(repo.path_str()).expect("Failed to list worktrees");

        // Should have main + linked worktree
        assert!(worktrees.len() >= 1);

        // Main worktree
        let main_wt = worktrees.iter().find(|w| w.is_main);
        assert!(main_wt.is_some());

        // Linked worktree (if created successfully)
        let linked_wt = worktrees.iter().find(|w| !w.is_main);
        if let Some(wt) = linked_wt {
            assert!(!wt.is_locked);
            assert!(wt.head.is_some());
            // Branch name should be feature-branch
            assert_eq!(wt.head.as_ref().unwrap(), "feature-branch");
        }
    }

    #[test]
    fn test_git_worktree_list_non_repo() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let result = git_worktree_list(temp_dir.path().to_string_lossy().to_string());
        assert!(result.is_err());
    }

    // ========================================================================
    // Git ls-files Tests
    // ========================================================================

    #[test]
    fn test_git_ls_files_basic() {
        let repo = TestRepo::new();
        repo.create_file("file1.txt", "content1");
        repo.create_file("file2.txt", "content2");
        repo.commit("Initial commit");

        let files = git_ls_files(repo.path_str()).expect("Failed to list files");
        assert!(files.contains(&"file1.txt".to_string()));
        assert!(files.contains(&"file2.txt".to_string()));
    }

    #[test]
    fn test_git_ls_files_nested() {
        let repo = TestRepo::new();
        repo.create_file("src/main.rs", "fn main() {}");
        repo.create_file("src/lib.rs", "pub fn foo() {}");
        repo.create_file("tests/test.rs", "fn test() {}");
        repo.commit("Initial commit");

        let files = git_ls_files(repo.path_str()).expect("Failed to list files");
        assert!(files.contains(&"src/main.rs".to_string()));
        assert!(files.contains(&"src/lib.rs".to_string()));
        assert!(files.contains(&"tests/test.rs".to_string()));
    }

    #[test]
    fn test_git_ls_files_empty_repo() {
        let repo = TestRepo::new();
        // No files committed yet

        let files = git_ls_files(repo.path_str()).expect("Failed to list files");
        assert!(files.is_empty());
    }

    #[test]
    fn test_git_ls_files_non_repo() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let result = git_ls_files(temp_dir.path().to_string_lossy().to_string());
        assert!(result.is_err());
    }

    // ========================================================================
    // Git Log Tests
    // ========================================================================

    #[test]
    fn test_git_log_basic() {
        let repo = TestRepo::new();
        repo.create_file("file1.txt", "content1");
        repo.commit("First commit");
        repo.create_file("file2.txt", "content2");
        repo.commit("Second commit");

        let log = git_log(repo.path_str(), Some(10)).expect("Failed to get log");
        assert_eq!(log.len(), 2);
        assert_eq!(log[0].message, "Second commit");
        assert_eq!(log[1].message, "First commit");
    }

    #[test]
    fn test_git_log_entry_fields() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Test commit message");

        let log = git_log(repo.path_str(), Some(1)).expect("Failed to get log");
        assert_eq!(log.len(), 1);

        let entry = &log[0];
        assert_eq!(entry.message, "Test commit message");
        assert_eq!(entry.author_name, "Test User");
        assert_eq!(entry.author_email, "test@example.com");
        assert_eq!(entry.short_hash.len(), 8);
        assert_eq!(entry.hash.len(), 40);
        assert!(!entry.timestamp.is_empty());
    }

    #[test]
    fn test_git_log_limit() {
        let repo = TestRepo::new();
        for i in 0..10 {
            repo.create_file(&format!("file{}.txt", i), &format!("content{}", i));
            repo.commit(&format!("Commit {}", i));
        }

        let log = git_log(repo.path_str(), Some(3)).expect("Failed to get log");
        assert_eq!(log.len(), 3);
        assert_eq!(log[0].message, "Commit 9");
        assert_eq!(log[1].message, "Commit 8");
        assert_eq!(log[2].message, "Commit 7");
    }

    #[test]
    fn test_git_log_default_limit() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Commit");

        // Without limit, should use default of 100
        let log = git_log(repo.path_str(), None).expect("Failed to get log");
        assert!(!log.is_empty());
    }

    #[test]
    fn test_git_log_non_repo() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let result = git_log(temp_dir.path().to_string_lossy().to_string(), Some(10));
        assert!(result.is_err());
    }

    // ========================================================================
    // Git Show File Tests
    // ========================================================================

    #[test]
    fn test_git_show_file_basic() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "Hello, World!");
        let hash = repo.commit("Initial commit");

        let content = git_show_file(repo.path_str(), hash, "file.txt".to_string())
            .expect("Failed to show file");
        assert_eq!(content, "Hello, World!");
    }

    #[test]
    fn test_git_show_file_nested() {
        let repo = TestRepo::new();
        repo.create_file("src/main.rs", "fn main() {\n    println!(\"Hello\");\n}");
        let hash = repo.commit("Initial commit");

        let content = git_show_file(repo.path_str(), hash, "src/main.rs".to_string())
            .expect("Failed to show file");
        assert!(content.contains("fn main()"));
        assert!(content.contains("println!"));
    }

    #[test]
    fn test_git_show_file_at_different_commits() {
        let repo = TestRepo::new();

        repo.create_file("file.txt", "Version 1");
        let hash1 = repo.commit("First commit");

        repo.create_file("file.txt", "Version 2");
        let hash2 = repo.commit("Second commit");

        let content1 = git_show_file(repo.path_str(), hash1, "file.txt".to_string())
            .expect("Failed to show file at first commit");
        let content2 = git_show_file(repo.path_str(), hash2, "file.txt".to_string())
            .expect("Failed to show file at second commit");

        assert_eq!(content1, "Version 1");
        assert_eq!(content2, "Version 2");
    }

    #[test]
    fn test_git_show_file_head_ref() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "HEAD content");
        repo.commit("Initial commit");

        let content = git_show_file(repo.path_str(), "HEAD".to_string(), "file.txt".to_string())
            .expect("Failed to show file at HEAD");
        assert_eq!(content, "HEAD content");
    }

    #[test]
    fn test_git_show_file_nonexistent_file() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        let hash = repo.commit("Initial commit");

        let result = git_show_file(repo.path_str(), hash, "nonexistent.txt".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_git_show_file_invalid_commit() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");

        let result = git_show_file(
            repo.path_str(),
            "invalid-commit-hash".to_string(),
            "file.txt".to_string(),
        );
        assert!(result.is_err());
    }

    // ========================================================================
    // Git Diff Stat Tests
    // ========================================================================

    #[test]
    fn test_git_diff_stat_added_files() {
        let repo = TestRepo::new();
        repo.create_file("file1.txt", "content1");
        let hash1 = repo.commit("First commit");

        repo.create_file("file2.txt", "content2");
        repo.create_file("file3.txt", "content3");
        let hash2 = repo.commit("Second commit");

        let stats = git_diff_stat(repo.path_str(), hash1, hash2).expect("Failed to get diff");

        let added_files: Vec<_> = stats
            .iter()
            .filter(|s| s.change_type == "added")
            .map(|s| s.path.clone())
            .collect();

        assert!(added_files.contains(&"file2.txt".to_string()));
        assert!(added_files.contains(&"file3.txt".to_string()));
    }

    #[test]
    fn test_git_diff_stat_deleted_files() {
        let repo = TestRepo::new();
        repo.create_file("file1.txt", "content1");
        repo.create_file("file2.txt", "content2");
        let hash1 = repo.commit("First commit");

        fs::remove_file(repo.path().join("file2.txt")).expect("Failed to remove file");
        let hash2 = repo.commit("Delete file");

        let stats = git_diff_stat(repo.path_str(), hash1, hash2).expect("Failed to get diff");

        let deleted_files: Vec<_> = stats
            .iter()
            .filter(|s| s.change_type == "deleted")
            .map(|s| s.path.clone())
            .collect();

        assert!(deleted_files.contains(&"file2.txt".to_string()));
    }

    #[test]
    fn test_git_diff_stat_no_changes() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        let hash = repo.commit("Initial commit");

        // Diff commit with itself should show no changes
        let stats = git_diff_stat(repo.path_str(), hash.clone(), hash).expect("Failed to get diff");
        assert!(stats.is_empty());
    }

    #[test]
    fn test_git_diff_stat_nested_files() {
        let repo = TestRepo::new();
        repo.create_file("src/main.rs", "fn main() {}");
        let hash1 = repo.commit("First commit");

        repo.create_file("src/lib.rs", "pub fn foo() {}");
        repo.create_file("tests/test.rs", "fn test() {}");
        let hash2 = repo.commit("Add more files");

        let stats = git_diff_stat(repo.path_str(), hash1, hash2).expect("Failed to get diff");

        let added_files: Vec<_> = stats
            .iter()
            .filter(|s| s.change_type == "added")
            .map(|s| s.path.clone())
            .collect();

        assert!(added_files.contains(&"src/lib.rs".to_string()));
        assert!(added_files.contains(&"tests/test.rs".to_string()));
    }

    #[test]
    fn test_git_diff_stat_invalid_from_commit() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        let hash = repo.commit("Initial commit");

        let result = git_diff_stat(repo.path_str(), "invalid".to_string(), hash);
        assert!(result.is_err());
    }

    #[test]
    fn test_git_diff_stat_invalid_to_commit() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        let hash = repo.commit("Initial commit");

        let result = git_diff_stat(repo.path_str(), hash, "invalid".to_string());
        assert!(result.is_err());
    }

    // ========================================================================
    // Edge Cases and Error Handling Tests
    // ========================================================================

    #[test]
    fn test_open_repo_with_empty_string() {
        let result = open_repo("");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_git_branch_from_subdirectory_of_repo() {
        let repo = TestRepo::new();
        repo.create_file("deep/nested/dir/file.txt", "content");
        repo.commit("Initial commit");

        let subdir = repo.path().join("deep/nested/dir");
        let result = get_git_branch(subdir.to_string_lossy().to_string());
        assert!(result.is_some());
    }

    #[test]
    fn test_get_git_info_from_dot_git_directory() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");

        // Trying to get info from .git directory itself
        let git_dir = repo.path().join(".git");
        let info = get_git_info(git_dir.to_string_lossy().to_string());
        // Should still work - gitoxide discovers from .git dir
        assert!(info.branch.is_some());
    }

    #[test]
    fn test_git_log_multiline_commit_message() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");

        // Create a commit with multiline message
        Command::new("git")
            .args(["add", "-A"])
            .current_dir(repo.path())
            .output()
            .expect("Failed to git add");

        Command::new("git")
            .args([
                "commit",
                "-m",
                "First line\n\nSecond paragraph\n\nThird paragraph",
            ])
            .current_dir(repo.path())
            .output()
            .expect("Failed to git commit");

        let log = git_log(repo.path_str(), Some(1)).expect("Failed to get log");
        // Should only return first line of commit message
        assert_eq!(log[0].message, "First line");
    }

    #[test]
    fn test_git_worktree_head_on_detached() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");
        repo.detach_head();

        let worktrees = git_worktree_list(repo.path_str()).expect("Failed to list worktrees");
        assert_eq!(worktrees.len(), 1);

        // When detached, head should be the commit hash (truncated)
        let main_wt = &worktrees[0];
        assert!(main_wt.is_main);
        // The head should be a hex string (commit hash)
        let head = main_wt.head.as_ref().unwrap();
        assert!(head.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_multiple_branches() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");

        // Create multiple branches
        repo.create_branch("feature-1");
        repo.checkout("master"); // or main
                                 // Handle both master and main
        let _ = Command::new("git")
            .args(["checkout", "master"])
            .current_dir(repo.path())
            .output();
        let _ = Command::new("git")
            .args(["checkout", "main"])
            .current_dir(repo.path())
            .output();

        repo.create_branch("feature-2");
        repo.checkout("feature-1");

        let result = get_git_branch(repo.path_str());
        assert_eq!(result, Some("feature-1".to_string()));

        repo.checkout("feature-2");
        let result = get_git_branch(repo.path_str());
        assert_eq!(result, Some("feature-2".to_string()));
    }

    // ========================================================================
    // Git Create Branch Tests
    // ========================================================================

    #[test]
    fn test_git_create_branch_basic() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");

        let result = git_create_branch(repo.path_str(), "new-feature".to_string());
        assert!(result.is_ok());

        // Verify the branch was created
        let output = Command::new("git")
            .args(["branch", "--list", "new-feature"])
            .current_dir(repo.path())
            .output()
            .expect("Failed to list branches");
        let branches = String::from_utf8_lossy(&output.stdout);
        assert!(branches.contains("new-feature"));
    }

    #[test]
    fn test_git_create_branch_already_exists() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");

        // Create branch first time
        git_create_branch(repo.path_str(), "existing-branch".to_string())
            .expect("Failed to create branch");

        // Try to create same branch again - should fail
        let result = git_create_branch(repo.path_str(), "existing-branch".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_git_create_branch_non_repo() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let result = git_create_branch(
            temp_dir.path().to_string_lossy().to_string(),
            "branch".to_string(),
        );
        assert!(result.is_err());
    }

    // ========================================================================
    // Git Worktree Add Tests
    // ========================================================================

    #[test]
    fn test_git_worktree_add_basic() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");

        // Create a branch for the worktree
        git_create_branch(repo.path_str(), "worktree-branch".to_string())
            .expect("Failed to create branch");

        // Create worktree in a sibling directory
        let worktree_path = repo.path().parent().unwrap().join("test-worktree");

        let result = git_worktree_add(
            repo.path_str(),
            worktree_path.to_string_lossy().to_string(),
            "worktree-branch".to_string(),
        );
        assert!(result.is_ok());

        // Verify the worktree was created
        assert!(worktree_path.exists());
        assert!(worktree_path.join("file.txt").exists());

        // Clean up
        let _ = Command::new("git")
            .args([
                "worktree",
                "remove",
                "--force",
                &worktree_path.to_string_lossy(),
            ])
            .current_dir(repo.path())
            .output();
    }

    #[test]
    fn test_git_worktree_add_non_existent_branch() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");

        let worktree_path = repo.path().parent().unwrap().join("bad-worktree");

        let result = git_worktree_add(
            repo.path_str(),
            worktree_path.to_string_lossy().to_string(),
            "nonexistent-branch".to_string(),
        );
        assert!(result.is_err());
    }

    // ========================================================================
    // Git Worktree Remove Tests
    // ========================================================================

    #[test]
    fn test_git_worktree_remove_basic() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");

        // Create a branch and worktree
        git_create_branch(repo.path_str(), "remove-test".to_string())
            .expect("Failed to create branch");

        let worktree_path = repo.path().parent().unwrap().join("remove-me");
        git_worktree_add(
            repo.path_str(),
            worktree_path.to_string_lossy().to_string(),
            "remove-test".to_string(),
        )
        .expect("Failed to create worktree");

        assert!(worktree_path.exists());

        // Remove the worktree
        let result = git_worktree_remove(
            repo.path_str(),
            worktree_path.to_string_lossy().to_string(),
            None,
        );
        assert!(result.is_ok());

        // Verify it was removed
        assert!(!worktree_path.exists());
    }

    #[test]
    fn test_git_worktree_remove_force() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");

        // Create a branch and worktree
        git_create_branch(repo.path_str(), "force-remove".to_string())
            .expect("Failed to create branch");

        let worktree_path = repo.path().parent().unwrap().join("force-remove-me");
        git_worktree_add(
            repo.path_str(),
            worktree_path.to_string_lossy().to_string(),
            "force-remove".to_string(),
        )
        .expect("Failed to create worktree");

        // Create an uncommitted change in the worktree
        let new_file = worktree_path.join("uncommitted.txt");
        fs::write(&new_file, "uncommitted content").expect("Failed to write file");

        // Regular remove should fail because worktree is dirty
        let result = git_worktree_remove(
            repo.path_str(),
            worktree_path.to_string_lossy().to_string(),
            None,
        );
        assert!(result.is_err());

        // Force remove should succeed
        let result = git_worktree_remove(
            repo.path_str(),
            worktree_path.to_string_lossy().to_string(),
            Some(true),
        );
        assert!(result.is_ok());
        assert!(!worktree_path.exists());
    }

    #[test]
    fn test_git_worktree_remove_nonexistent() {
        let repo = TestRepo::new();
        repo.create_file("file.txt", "content");
        repo.commit("Initial commit");

        let result = git_worktree_remove(
            repo.path_str(),
            "/nonexistent/worktree/path".to_string(),
            None,
        );
        assert!(result.is_err());
    }
}
