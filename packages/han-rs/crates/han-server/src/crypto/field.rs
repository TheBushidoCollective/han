//! Field-level encryption for database columns.
//!
//! Format: `v1:<nonce_b64>:<wrapped_dek_b64>:<ciphertext_b64>`
//! This allows each field to carry its own DEK, enabling per-team key rotation
//! without re-encrypting all fields.

use base64::{engine::general_purpose::STANDARD as B64, Engine};

use super::aes_gcm::{self, CryptoError, NONCE_SIZE};
use super::kek::{self, WrappedKey};

const FIELD_VERSION: &str = "v1";
const SEPARATOR: char = ':';

/// Encrypted field containing all data needed for decryption.
#[derive(Debug, Clone)]
pub struct EncryptedField {
    /// Version tag.
    pub version: String,
    /// Base64 nonce for field encryption.
    pub nonce: String,
    /// Wrapped DEK metadata.
    pub wrapped_key: WrappedKey,
    /// Base64 ciphertext.
    pub ciphertext: String,
}

/// Encrypt a field value.
///
/// Generates a fresh DEK, wraps it with the master KEK, and encrypts the value.
pub fn encrypt_field(master_secret: &str, plaintext: &str) -> Result<String, CryptoError> {
    let (dek, wrapped_key) = kek::generate_and_wrap_dek(master_secret)?;

    let (ciphertext, nonce) = aes_gcm::encrypt(&dek, plaintext.as_bytes())?;

    // Format: v1:nonce:wrapped_dek:wrap_nonce:kek_salt:ciphertext
    Ok(format!(
        "{FIELD_VERSION}{sep}{nonce}{sep}{wrapped_dek}{sep}{wrap_nonce}{sep}{kek_salt}{sep}{ct}",
        sep = SEPARATOR,
        nonce = B64.encode(nonce),
        wrapped_dek = wrapped_key.wrapped_dek,
        wrap_nonce = wrapped_key.wrap_nonce,
        kek_salt = wrapped_key.kek_salt,
        ct = B64.encode(&ciphertext),
    ))
}

/// Decrypt a field value.
pub fn decrypt_field(master_secret: &str, encrypted: &str) -> Result<String, CryptoError> {
    let parts: Vec<&str> = encrypted.split(SEPARATOR).collect();
    if parts.len() != 6 {
        return Err(CryptoError::InvalidFormat);
    }

    let [version, nonce_b64, wrapped_dek_b64, wrap_nonce_b64, kek_salt_b64, ct_b64] =
        [parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]];

    if version != FIELD_VERSION {
        return Err(CryptoError::InvalidFormat);
    }

    // Reconstruct wrapped key
    let wrapped_key = WrappedKey {
        wrapped_dek: wrapped_dek_b64.to_string(),
        wrap_nonce: wrap_nonce_b64.to_string(),
        kek_salt: kek_salt_b64.to_string(),
    };

    // Unwrap DEK
    let dek = kek::unwrap_dek(master_secret, &wrapped_key)?;

    // Decode nonce and ciphertext
    let nonce_bytes = B64.decode(nonce_b64).map_err(|_| CryptoError::InvalidFormat)?;
    let ciphertext = B64.decode(ct_b64).map_err(|_| CryptoError::InvalidFormat)?;

    if nonce_bytes.len() != NONCE_SIZE {
        return Err(CryptoError::InvalidNonceLength);
    }

    let mut nonce = [0u8; NONCE_SIZE];
    nonce.copy_from_slice(&nonce_bytes);

    // Decrypt
    let plaintext = aes_gcm::decrypt(&dek, &nonce, &ciphertext)?;

    String::from_utf8(plaintext).map_err(|_| CryptoError::DecryptionFailed)
}

/// Re-encrypt a field with a new master secret (KEK rotation).
///
/// Only re-wraps the DEK - does NOT re-encrypt the data.
pub fn rotate_field_kek(
    old_master_secret: &str,
    new_master_secret: &str,
    encrypted: &str,
) -> Result<String, CryptoError> {
    let parts: Vec<&str> = encrypted.split(SEPARATOR).collect();
    if parts.len() != 6 {
        return Err(CryptoError::InvalidFormat);
    }

    let [version, nonce_b64, wrapped_dek_b64, wrap_nonce_b64, kek_salt_b64, ct_b64] =
        [parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]];

    if version != FIELD_VERSION {
        return Err(CryptoError::InvalidFormat);
    }

    let old_wrapped = WrappedKey {
        wrapped_dek: wrapped_dek_b64.to_string(),
        wrap_nonce: wrap_nonce_b64.to_string(),
        kek_salt: kek_salt_b64.to_string(),
    };

    // Rotate the KEK wrapping
    let new_wrapped = kek::rotate_kek(old_master_secret, new_master_secret, &old_wrapped)?;

    // Reconstruct with new wrapped key, same nonce and ciphertext
    Ok(format!(
        "{version}{sep}{nonce}{sep}{wrapped_dek}{sep}{wrap_nonce}{sep}{kek_salt}{sep}{ct}",
        sep = SEPARATOR,
        nonce = nonce_b64,
        wrapped_dek = new_wrapped.wrapped_dek,
        wrap_nonce = new_wrapped.wrap_nonce,
        kek_salt = new_wrapped.kek_salt,
        ct = ct_b64,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    const MASTER: &str = "field-encryption-master-secret-32";

    #[test]
    fn test_encrypt_decrypt_field() {
        let plaintext = "sensitive session data here";
        let encrypted = encrypt_field(MASTER, plaintext).unwrap();

        assert!(encrypted.starts_with("v1:"));

        let decrypted = decrypt_field(MASTER, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_wrong_master_fails() {
        let encrypted = encrypt_field(MASTER, "secret").unwrap();
        let result = decrypt_field("wrong-master-secret-for-testing!!", &encrypted);
        assert!(result.is_err());
    }

    #[test]
    fn test_kek_rotation_preserves_data() {
        let old_secret = "old-field-master-secret-for-test";
        let new_secret = "new-field-master-secret-for-test";
        let plaintext = "session data that should survive rotation";

        let encrypted = encrypt_field(old_secret, plaintext).unwrap();
        let rotated = rotate_field_kek(old_secret, new_secret, &encrypted).unwrap();

        // Can decrypt with new secret
        let decrypted = decrypt_field(new_secret, &rotated).unwrap();
        assert_eq!(decrypted, plaintext);

        // Cannot decrypt with old secret
        let result = decrypt_field(old_secret, &rotated);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_string() {
        let encrypted = encrypt_field(MASTER, "").unwrap();
        let decrypted = decrypt_field(MASTER, &encrypted).unwrap();
        assert_eq!(decrypted, "");
    }

    #[test]
    fn test_unicode_content() {
        let plaintext = "日本語テスト 🎌 données françaises";
        let encrypted = encrypt_field(MASTER, plaintext).unwrap();
        let decrypted = decrypt_field(MASTER, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_invalid_format() {
        assert!(decrypt_field(MASTER, "not-valid").is_err());
        assert!(decrypt_field(MASTER, "v2:a:b:c:d:e").is_err());
        assert!(decrypt_field(MASTER, "v1:bad").is_err());
    }
}
