/**
 * Encryption Service for Han Team Platform
 *
 * Provides envelope encryption with AES-256-GCM.
 * DEKs are wrapped with KEKs stored securely.
 *
 * NOTE: This is a stub interface. Full implementation in unit-02-encryption-service.
 */

/**
 * Encrypted data envelope
 */
export interface EncryptedEnvelope {
  /** Encrypted content (base64) */
  ciphertext: string;
  /** Initialization vector (base64) */
  nonce: string;
  /** Key ID used for encryption */
  keyId: string;
  /** Encryption algorithm identifier */
  algorithm: "aes-256-gcm";
  /** Authentication tag (base64) */
  authTag: string;
}

/**
 * Encryption key metadata
 */
export interface EncryptionKey {
  id: string;
  teamId: string | null;
  userId: string | null;
  createdAt: Date;
  rotatedAt: Date | null;
  status: "active" | "rotated" | "revoked";
}

/**
 * Options for encryption operations
 */
export interface EncryptionOptions {
  /** Team ID for team-scoped encryption */
  teamId?: string;
  /** User ID for user-scoped encryption */
  userId?: string;
  /** Additional authenticated data */
  aad?: string;
}

/**
 * Async Encryption Service
 *
 * Handles envelope encryption for session data using Web Crypto API.
 * For synchronous operations, use EncryptionService from encryption-service-sync.ts.
 */
export class AsyncEncryptionService {
  private masterKey: Buffer | null = null;
  private initialized = false;

  /**
   * Initialize the encryption service with a master key
   */
  async initialize(masterKeyBase64?: string): Promise<void> {
    if (masterKeyBase64) {
      this.masterKey = Buffer.from(masterKeyBase64, "base64");
      if (this.masterKey.length < 32) {
        throw new Error("Master key must be at least 32 bytes");
      }
    }
    this.initialized = true;
  }

  /**
   * Check if encryption is available
   */
  isAvailable(): boolean {
    return this.initialized && this.masterKey !== null;
  }

  /**
   * Encrypt plaintext data
   */
  async encrypt(
    plaintext: string,
    options: EncryptionOptions
  ): Promise<EncryptedEnvelope> {
    if (!this.isAvailable()) {
      throw new EncryptionNotAvailableError(
        "Encryption service not initialized or master key not provisioned"
      );
    }

    // Generate key ID and derive the DEK deterministically
    const keyId = this.generateKeyId(options);
    const dek = await this.deriveKeyFromId(keyId);
    const nonce = crypto.getRandomValues(new Uint8Array(12));

    // Import DEK for encryption
    const key = await crypto.subtle.importKey(
      "raw",
      dek as unknown as BufferSource,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    // Prepare AAD
    const aadBytes = options.aad
      ? new TextEncoder().encode(options.aad)
      : undefined;

    // Encrypt the plaintext
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: aadBytes,
        tagLength: 128,
      },
      key,
      plaintextBytes
    );

    // Split ciphertext and auth tag (last 16 bytes)
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    return {
      ciphertext: Buffer.from(ciphertext).toString("base64"),
      nonce: Buffer.from(nonce).toString("base64"),
      keyId,
      algorithm: "aes-256-gcm",
      authTag: Buffer.from(authTag).toString("base64"),
    };
  }

  /**
   * Decrypt an encrypted envelope
   */
  async decrypt(
    envelope: EncryptedEnvelope,
    options: EncryptionOptions
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new EncryptionNotAvailableError(
        "Encryption service not initialized or master key not provisioned"
      );
    }

    // Decode components
    const ciphertext = Buffer.from(envelope.ciphertext, "base64");
    const nonce = Buffer.from(envelope.nonce, "base64");
    const authTag = Buffer.from(envelope.authTag, "base64");

    // Combine ciphertext and auth tag for WebCrypto
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);

    // Derive the DEK from key ID (stub implementation)
    const dek = await this.deriveKeyFromId(envelope.keyId);

    // Import DEK for decryption
    const key = await crypto.subtle.importKey(
      "raw",
      dek as unknown as BufferSource,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Prepare AAD
    const aadBytes = options.aad
      ? new TextEncoder().encode(options.aad)
      : undefined;

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: aadBytes,
        tagLength: 128,
      },
      key,
      combined
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Get or create an encryption key for a scope
   */
  async getOrCreateKey(options: EncryptionOptions): Promise<EncryptionKey> {
    const keyId = this.generateKeyId(options);

    return {
      id: keyId,
      teamId: options.teamId || null,
      userId: options.userId || null,
      createdAt: new Date(),
      rotatedAt: null,
      status: "active",
    };
  }

  /**
   * Generate a deterministic key ID based on scope
   */
  private generateKeyId(options: EncryptionOptions): string {
    if (options.teamId) {
      return `team:${options.teamId}`;
    }
    if (options.userId) {
      return `user:${options.userId}`;
    }
    return `global:default`;
  }

  /**
   * Derive a DEK from a key ID (stub implementation)
   *
   * In production, this would look up a wrapped DEK and unwrap it.
   */
  private async deriveKeyFromId(keyId: string): Promise<Uint8Array> {
    if (!this.masterKey) {
      throw new EncryptionNotAvailableError("Master key not available");
    }

    // Use HKDF to derive a key from the master key and key ID
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      this.masterKey as unknown as BufferSource,
      "HKDF",
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new TextEncoder().encode("han-team-dek"),
        info: new TextEncoder().encode(keyId),
      },
      keyMaterial,
      256
    );

    return new Uint8Array(derivedBits);
  }
}

/**
 * Error thrown when encryption is not available
 */
export class EncryptionNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionNotAvailableError";
  }
}

/**
 * Singleton instance
 */
let _instance: AsyncEncryptionService | null = null;

/**
 * Get the async encryption service instance
 */
export function getAsyncEncryptionService(): AsyncEncryptionService {
  if (!_instance) {
    _instance = new AsyncEncryptionService();
  }
  return _instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetEncryptionService(): void {
  _instance = null;
}
