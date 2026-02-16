//! Cryptography module: AES-256-GCM, KEK management, field-level encryption.

pub mod aes_gcm;
pub mod field;
pub mod kek;

#[cfg(test)]
mod tests {
    /// Verify that AES-GCM encryption types and functions are accessible via the crypto module.
    #[test]
    fn test_aes_gcm_api_accessible() {
        use super::aes_gcm::{decrypt, encrypt, generate_key, CryptoError, KEY_SIZE, NONCE_SIZE};

        assert_eq!(KEY_SIZE, 32);
        assert_eq!(NONCE_SIZE, 12);

        let key = generate_key();
        assert_eq!(key.len(), KEY_SIZE);

        let plaintext = b"test data for module-level test";
        let (ciphertext, nonce) = encrypt(&key, plaintext).unwrap();
        assert_ne!(ciphertext.as_slice(), plaintext);
        assert_eq!(nonce.len(), NONCE_SIZE);

        let decrypted = decrypt(&key, &nonce, &ciphertext).unwrap();
        assert_eq!(decrypted, plaintext);

        // Verify CryptoError variants exist and implement Display
        let err = CryptoError::EncryptionFailed;
        assert_eq!(format!("{}", err), "Encryption failed");

        let err = CryptoError::DecryptionFailed;
        assert_eq!(format!("{}", err), "Decryption failed");

        let err = CryptoError::InvalidKeyLength;
        assert_eq!(format!("{}", err), "Invalid key length");

        let err = CryptoError::InvalidNonceLength;
        assert_eq!(format!("{}", err), "Invalid nonce length");

        let err = CryptoError::InvalidFormat;
        assert_eq!(format!("{}", err), "Invalid ciphertext format");

        let err = CryptoError::KeyDerivation("test reason".to_string());
        assert_eq!(format!("{}", err), "Key derivation failed: test reason");
    }

    /// Verify that KEK types and functions are accessible via the crypto module.
    #[test]
    fn test_kek_api_accessible() {
        use super::kek::{derive_kek, generate_and_wrap_dek, unwrap_dek};

        let master_secret = "test-master-secret-for-module-test";

        // Test derive_kek with known salt
        let salt = [42u8; 16];
        let kek = derive_kek(master_secret, &salt).unwrap();
        assert_eq!(kek.len(), 32);

        // Test generate_and_wrap_dek + unwrap_dek roundtrip
        let (dek, wrapped) = generate_and_wrap_dek(master_secret).unwrap();
        assert_eq!(dek.len(), 32);

        // Verify WrappedKey fields are accessible
        assert!(!wrapped.wrapped_dek.is_empty());
        assert!(!wrapped.wrap_nonce.is_empty());
        assert!(!wrapped.kek_salt.is_empty());

        // Verify WrappedKey derives Clone and Debug
        let cloned = wrapped.clone();
        assert_eq!(cloned.wrapped_dek, wrapped.wrapped_dek);
        let debug = format!("{:?}", wrapped);
        assert!(debug.contains("WrappedKey"));

        let unwrapped = unwrap_dek(master_secret, &wrapped).unwrap();
        assert_eq!(dek, unwrapped);
    }

    /// Verify that field-level encryption types and functions are accessible via the crypto module.
    #[test]
    fn test_field_api_accessible() {
        use super::field::{decrypt_field, encrypt_field, rotate_field_kek, EncryptedField};

        let master = "module-test-master-secret-32-chr";

        // Encrypt/decrypt roundtrip
        let plaintext = "sensitive data for module test";
        let encrypted = encrypt_field(master, plaintext).unwrap();
        assert!(encrypted.starts_with("v1:"));

        let decrypted = decrypt_field(master, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);

        // Test KEK rotation through module API
        let new_master = "new-module-test-master-secret-32";
        let rotated = rotate_field_kek(master, new_master, &encrypted).unwrap();
        let decrypted_after_rotation = decrypt_field(new_master, &rotated).unwrap();
        assert_eq!(decrypted_after_rotation, plaintext);

        // Verify EncryptedField struct is accessible and derives Clone/Debug
        let field = EncryptedField {
            version: "v1".to_string(),
            nonce: "test-nonce".to_string(),
            wrapped_key: super::kek::WrappedKey {
                wrapped_dek: "test-dek".to_string(),
                wrap_nonce: "test-wnonce".to_string(),
                kek_salt: "test-salt".to_string(),
            },
            ciphertext: "test-ct".to_string(),
        };
        let cloned = field.clone();
        assert_eq!(cloned.version, "v1");
        assert_eq!(cloned.ciphertext, "test-ct");
        let debug = format!("{:?}", field);
        assert!(debug.contains("EncryptedField"));
    }

    /// Verify cross-module integration: field encryption uses KEK which uses AES-GCM.
    #[test]
    fn test_crypto_stack_integration() {
        use super::aes_gcm::generate_key;
        use super::field::{decrypt_field, encrypt_field};
        use super::kek::generate_and_wrap_dek;

        let master = "integration-test-master-secret32";

        // The full stack works: field -> kek -> aes_gcm
        let data = "cross-module integration test data";
        let encrypted = encrypt_field(master, data).unwrap();
        let decrypted = decrypt_field(master, &encrypted).unwrap();
        assert_eq!(decrypted, data);

        // Lower-level APIs also work independently
        let key = generate_key();
        assert_eq!(key.len(), 32);

        let (_dek, wrapped) = generate_and_wrap_dek(master).unwrap();
        assert!(!wrapped.wrapped_dek.is_empty());
    }
}
