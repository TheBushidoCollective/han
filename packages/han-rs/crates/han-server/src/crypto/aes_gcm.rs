//! AES-256-GCM authenticated encryption.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, AeadCore, Key, Nonce,
};

/// AES-256-GCM key size in bytes.
pub const KEY_SIZE: usize = 32;
/// AES-256-GCM nonce size in bytes.
pub const NONCE_SIZE: usize = 12;

/// Encrypt plaintext with AES-256-GCM.
///
/// Returns ciphertext with appended authentication tag (16 bytes).
pub fn encrypt(key: &[u8; KEY_SIZE], plaintext: &[u8]) -> Result<(Vec<u8>, [u8; NONCE_SIZE]), CryptoError> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|_| CryptoError::EncryptionFailed)?;

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    nonce_bytes.copy_from_slice(nonce.as_slice());

    Ok((ciphertext, nonce_bytes))
}

/// Decrypt ciphertext with AES-256-GCM.
pub fn decrypt(
    key: &[u8; KEY_SIZE],
    nonce: &[u8; NONCE_SIZE],
    ciphertext: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Nonce::from_slice(nonce);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptionFailed)
}

/// Generate a random 256-bit key.
pub fn generate_key() -> [u8; KEY_SIZE] {
    use rand::RngCore;
    let mut key = [0u8; KEY_SIZE];
    OsRng.fill_bytes(&mut key);
    key
}

/// Crypto errors.
#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Encryption failed")]
    EncryptionFailed,
    #[error("Decryption failed")]
    DecryptionFailed,
    #[error("Invalid key length")]
    InvalidKeyLength,
    #[error("Invalid nonce length")]
    InvalidNonceLength,
    #[error("Invalid ciphertext format")]
    InvalidFormat,
    #[error("Key derivation failed: {0}")]
    KeyDerivation(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = generate_key();
        let plaintext = b"Hello, world!";

        let (ciphertext, nonce) = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &nonce, &ciphertext).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1 = generate_key();
        let key2 = generate_key();
        let plaintext = b"secret data";

        let (ciphertext, nonce) = encrypt(&key1, plaintext).unwrap();
        let result = decrypt(&key2, &nonce, &ciphertext);
        assert!(result.is_err());
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let key = generate_key();
        let plaintext = b"important data";

        let (mut ciphertext, nonce) = encrypt(&key, plaintext).unwrap();
        // Tamper with ciphertext
        if let Some(byte) = ciphertext.first_mut() {
            *byte ^= 0xFF;
        }
        let result = decrypt(&key, &nonce, &ciphertext);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_plaintext() {
        let key = generate_key();
        let (ciphertext, nonce) = encrypt(&key, b"").unwrap();
        let decrypted = decrypt(&key, &nonce, &ciphertext).unwrap();
        assert!(decrypted.is_empty());
    }

    #[test]
    fn test_large_plaintext() {
        let key = generate_key();
        let plaintext = vec![0xABu8; 1_000_000]; // 1MB

        let (ciphertext, nonce) = encrypt(&key, &plaintext).unwrap();
        let decrypted = decrypt(&key, &nonce, &ciphertext).unwrap();
        assert_eq!(decrypted, plaintext);
    }
}
