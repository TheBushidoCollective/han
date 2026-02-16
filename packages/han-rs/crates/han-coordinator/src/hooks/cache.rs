//! Hook file validation caching.
//!
//! Tracks SHA256 hashes of files to skip hook execution when files haven't changed.
//! Keyed by (plugin_name, hook_name, command_hash).

use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;

/// Cache key for a hook's file validation.
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct CacheKey {
    pub plugin_name: String,
    pub hook_name: String,
    pub command_hash: String,
}

/// Cache entry tracking file hashes for a hook run.
#[derive(Debug, Clone)]
pub struct CacheEntry {
    /// Map of file_path -> SHA256 hash at last successful validation.
    pub file_hashes: HashMap<String, String>,
}

/// Hook validation cache.
#[derive(Debug, Default)]
pub struct HookCache {
    entries: HashMap<CacheKey, CacheEntry>,
}

impl HookCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if all files still match their cached hashes.
    /// Returns true if all files are unchanged (hook can be skipped).
    pub fn is_valid(&self, key: &CacheKey, files: &[String]) -> bool {
        let entry = match self.entries.get(key) {
            Some(e) => e,
            None => return false,
        };

        for file_path in files {
            let cached_hash = match entry.file_hashes.get(file_path) {
                Some(h) => h,
                None => return false,
            };

            let current_hash = match compute_file_hash(file_path) {
                Some(h) => h,
                None => return false,
            };

            if *cached_hash != current_hash {
                return false;
            }
        }

        true
    }

    /// Update the cache with current file hashes after a successful hook run.
    pub fn update(&mut self, key: CacheKey, files: &[String]) {
        let mut file_hashes = HashMap::new();
        for file_path in files {
            if let Some(hash) = compute_file_hash(file_path) {
                file_hashes.insert(file_path.clone(), hash);
            }
        }
        self.entries.insert(key, CacheEntry { file_hashes });
    }

    /// Invalidate a specific cache entry.
    pub fn invalidate(&mut self, key: &CacheKey) {
        self.entries.remove(key);
    }

    /// Clear the entire cache.
    pub fn clear(&mut self) {
        self.entries.clear();
    }

    /// Get the number of cached entries.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Check if the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

/// Compute SHA256 hash of a file.
pub fn compute_file_hash(path: &str) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        match file.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buffer[..n]),
            Err(_) => return None,
        }
    }
    Some(format!("{:x}", hasher.finalize()))
}

/// Compute SHA256 hash of a string (for command hashing).
pub fn hash_string(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_cache_miss_on_empty() {
        let cache = HookCache::new();
        let key = CacheKey {
            plugin_name: "biome".into(),
            hook_name: "lint".into(),
            command_hash: "abc".into(),
        };
        assert!(!cache.is_valid(&key, &["/some/file.ts".into()]));
    }

    #[test]
    fn test_cache_hit_after_update() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("test.ts");
        std::fs::write(&file_path, "const x = 1;").unwrap();

        let mut cache = HookCache::new();
        let key = CacheKey {
            plugin_name: "biome".into(),
            hook_name: "lint".into(),
            command_hash: "abc".into(),
        };

        let files = vec![file_path.to_string_lossy().to_string()];
        cache.update(key.clone(), &files);

        // Same file content -> cache hit
        assert!(cache.is_valid(&key, &files));
    }

    #[test]
    fn test_cache_miss_after_file_change() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("test.ts");
        std::fs::write(&file_path, "const x = 1;").unwrap();

        let mut cache = HookCache::new();
        let key = CacheKey {
            plugin_name: "biome".into(),
            hook_name: "lint".into(),
            command_hash: "abc".into(),
        };

        let files = vec![file_path.to_string_lossy().to_string()];
        cache.update(key.clone(), &files);

        // Change file content
        std::fs::write(&file_path, "const x = 2;").unwrap();

        // Different content -> cache miss
        assert!(!cache.is_valid(&key, &files));
    }

    #[test]
    fn test_invalidate() {
        let mut cache = HookCache::new();
        let key = CacheKey {
            plugin_name: "biome".into(),
            hook_name: "lint".into(),
            command_hash: "abc".into(),
        };
        cache.update(key.clone(), &[]);
        assert_eq!(cache.len(), 1);

        cache.invalidate(&key);
        assert!(cache.is_empty());
    }

    #[test]
    fn test_hash_string() {
        let h1 = hash_string("hello");
        let h2 = hash_string("hello");
        let h3 = hash_string("world");

        assert_eq!(h1, h2);
        assert_ne!(h1, h3);
        assert_eq!(h1.len(), 64); // SHA256 hex = 64 chars
    }
}
