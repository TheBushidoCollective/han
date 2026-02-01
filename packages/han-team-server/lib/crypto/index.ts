/**
 * Cryptographic Module for Session Encryption
 *
 * Provides envelope encryption for session data:
 * - Master Secret -> KEK (Key Encryption Key)
 * - KEK encrypts DEK (Data Encryption Key)
 * - DEK encrypts session data
 */

export * from "./types.ts";
export * from "./kek.ts";
export * from "./encryption-service.ts";
export * from "./aes-gcm.ts";
export * from "./key-derivation.ts";
