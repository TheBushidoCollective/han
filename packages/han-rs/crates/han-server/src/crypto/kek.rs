//! Key Encryption Key (KEK) management.
//!
//! Uses Argon2id to derive KEK from master secret, then wraps/unwraps
//! Data Encryption Keys (DEKs) with AES-256-GCM.

use argon2::{Argon2, Algorithm, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;

use super::aes_gcm::{self, CryptoError, KEY_SIZE, NONCE_SIZE};

/// Salt size for Argon2id key derivation.
const SALT_SIZE: usize = 16;

/// Argon2id parameters (OWASP recommendations).
const ARGON2_MEMORY_KB: u32 = 65_536; // 64 MB
const ARGON2_ITERATIONS: u32 = 3;
const ARGON2_PARALLELISM: u32 = 1;

/// A wrapped DEK with its wrapping metadata.
#[derive(Debug, Clone)]
pub struct WrappedKey {
    /// Base64-encoded wrapped DEK ciphertext.
    pub wrapped_dek: String,
    /// Base64-encoded nonce used for wrapping.
    pub wrap_nonce: String,
    /// Base64-encoded salt used for KEK derivation.
    pub kek_salt: String,
}

/// Derive a KEK from a master secret using Argon2id.
pub fn derive_kek(master_secret: &str, salt: &[u8]) -> Result<[u8; KEY_SIZE], CryptoError> {
    let params = Params::new(
        ARGON2_MEMORY_KB,
        ARGON2_ITERATIONS,
        ARGON2_PARALLELISM,
        Some(KEY_SIZE),
    )
    .map_err(|e| CryptoError::KeyDerivation(format!("Invalid Argon2 params: {e}")))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut kek = [0u8; KEY_SIZE];
    argon2
        .hash_password_into(master_secret.as_bytes(), salt, &mut kek)
        .map_err(|e| CryptoError::KeyDerivation(format!("Argon2 derivation failed: {e}")))?;

    Ok(kek)
}

/// Generate a new DEK and wrap it with a KEK derived from the master secret.
pub fn generate_and_wrap_dek(master_secret: &str) -> Result<([u8; KEY_SIZE], WrappedKey), CryptoError> {
    let dek = aes_gcm::generate_key();

    // Generate random salt for KEK derivation
    let mut salt = [0u8; SALT_SIZE];
    rand::rngs::OsRng.fill_bytes(&mut salt);

    // Derive KEK from master secret
    let kek = derive_kek(master_secret, &salt)?;

    // Wrap DEK with KEK using AES-256-GCM
    let (wrapped, nonce) = aes_gcm::encrypt(&kek, &dek)?;

    Ok((dek, WrappedKey {
        wrapped_dek: B64.encode(&wrapped),
        wrap_nonce: B64.encode(nonce),
        kek_salt: B64.encode(salt),
    }))
}

/// Unwrap a DEK using a KEK derived from the master secret.
pub fn unwrap_dek(master_secret: &str, wrapped: &WrappedKey) -> Result<[u8; KEY_SIZE], CryptoError> {
    let salt = B64
        .decode(&wrapped.kek_salt)
        .map_err(|_| CryptoError::InvalidFormat)?;
    let nonce_bytes = B64
        .decode(&wrapped.wrap_nonce)
        .map_err(|_| CryptoError::InvalidFormat)?;
    let wrapped_bytes = B64
        .decode(&wrapped.wrapped_dek)
        .map_err(|_| CryptoError::InvalidFormat)?;

    if nonce_bytes.len() != NONCE_SIZE {
        return Err(CryptoError::InvalidNonceLength);
    }

    let mut nonce = [0u8; NONCE_SIZE];
    nonce.copy_from_slice(&nonce_bytes);

    // Derive KEK
    let kek = derive_kek(master_secret, &salt)?;

    // Unwrap DEK
    let dek_bytes = aes_gcm::decrypt(&kek, &nonce, &wrapped_bytes)?;

    if dek_bytes.len() != KEY_SIZE {
        return Err(CryptoError::InvalidKeyLength);
    }

    let mut dek = [0u8; KEY_SIZE];
    dek.copy_from_slice(&dek_bytes);
    Ok(dek)
}

/// Re-wrap a DEK with a new master secret (KEK rotation).
///
/// This unwraps the DEK using the old secret and re-wraps with the new secret,
/// without re-encrypting the data.
pub fn rotate_kek(
    old_master_secret: &str,
    new_master_secret: &str,
    old_wrapped: &WrappedKey,
) -> Result<WrappedKey, CryptoError> {
    // Unwrap with old KEK
    let dek = unwrap_dek(old_master_secret, old_wrapped)?;

    // Generate new salt
    let mut new_salt = [0u8; SALT_SIZE];
    rand::rngs::OsRng.fill_bytes(&mut new_salt);

    // Derive new KEK
    let new_kek = derive_kek(new_master_secret, &new_salt)?;

    // Re-wrap DEK with new KEK
    let (wrapped, nonce) = aes_gcm::encrypt(&new_kek, &dek)?;

    Ok(WrappedKey {
        wrapped_dek: B64.encode(&wrapped),
        wrap_nonce: B64.encode(nonce),
        kek_salt: B64.encode(new_salt),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const MASTER_SECRET: &str = "test-master-secret-for-kek-derivation";

    #[test]
    fn test_generate_and_unwrap_dek() {
        let (dek, wrapped) = generate_and_wrap_dek(MASTER_SECRET).unwrap();
        let unwrapped = unwrap_dek(MASTER_SECRET, &wrapped).unwrap();
        assert_eq!(dek, unwrapped);
    }

    #[test]
    fn test_wrong_master_secret_fails() {
        let (_, wrapped) = generate_and_wrap_dek(MASTER_SECRET).unwrap();
        let result = unwrap_dek("wrong-master-secret-for-testing!!", &wrapped);
        assert!(result.is_err());
    }

    #[test]
    fn test_kek_rotation() {
        let old_secret = "old-master-secret-for-kek-rotation";
        let new_secret = "new-master-secret-for-kek-rotation";

        // Generate and wrap with old secret
        let (original_dek, old_wrapped) = generate_and_wrap_dek(old_secret).unwrap();

        // Rotate KEK
        let new_wrapped = rotate_kek(old_secret, new_secret, &old_wrapped).unwrap();

        // Unwrap with new secret should give same DEK
        let unwrapped = unwrap_dek(new_secret, &new_wrapped).unwrap();
        assert_eq!(original_dek, unwrapped);

        // Old secret should no longer work on new wrapped key
        let result = unwrap_dek(old_secret, &new_wrapped);
        assert!(result.is_err());
    }

    #[test]
    fn test_derive_kek_deterministic_with_same_salt() {
        let salt = [42u8; SALT_SIZE];
        let kek1 = derive_kek(MASTER_SECRET, &salt).unwrap();
        let kek2 = derive_kek(MASTER_SECRET, &salt).unwrap();
        assert_eq!(kek1, kek2);
    }

    #[test]
    fn test_derive_kek_different_salts() {
        let salt1 = [1u8; SALT_SIZE];
        let salt2 = [2u8; SALT_SIZE];
        let kek1 = derive_kek(MASTER_SECRET, &salt1).unwrap();
        let kek2 = derive_kek(MASTER_SECRET, &salt2).unwrap();
        assert_ne!(kek1, kek2);
    }
}
