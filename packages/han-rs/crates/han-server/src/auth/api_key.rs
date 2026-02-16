//! API key authentication via SHA-256 hash lookup.

use sha2::{Digest, Sha256};

/// Hash an API key using SHA-256 for storage/lookup.
pub fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}

/// Generate a random API key with a prefix.
pub fn generate_api_key() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    format!("han_{}", hex::encode(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_api_key_deterministic() {
        let key = "han_abc123";
        let hash1 = hash_api_key(key);
        let hash2 = hash_api_key(key);
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // SHA-256 hex = 64 chars
    }

    #[test]
    fn test_different_keys_different_hashes() {
        let hash1 = hash_api_key("key1");
        let hash2 = hash_api_key("key2");
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_generate_api_key_format() {
        let key = generate_api_key();
        assert!(key.starts_with("han_"));
        assert_eq!(key.len(), 68); // "han_" + 64 hex chars
    }
}
