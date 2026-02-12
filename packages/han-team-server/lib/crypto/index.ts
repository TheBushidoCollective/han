/**
 * Cryptographic Module for Session Encryption
 *
 * Provides envelope encryption for session data:
 * - Master Secret -> KEK (Key Encryption Key)
 * - KEK encrypts DEK (Data Encryption Key)
 * - DEK encrypts session data
 */

export * from './aes-gcm.ts';
export * from './encryption-service.ts';
export {
  type EncryptedData,
  type EncryptedWithKeyResult,
  encryptionService,
  type WrappedKeyResult,
} from './encryption-service-sync.ts';
export * from './kek.ts';
export * from './key-derivation.ts';
export * from './timing-safe.ts';
export * from './types.ts';
