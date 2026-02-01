/**
 * Session Encryption Service for Han Team Platform
 *
 * Orchestrates encryption, secret detection, and audit logging
 * for session data operations.
 */

import {
  EncryptionService,
  EncryptionNotAvailableError,
  type EncryptedEnvelope,
} from "../crypto/index.ts";
import { getSecretDetector, type ScanResult } from "../security/index.ts";
import { getAuditService } from "../audit/index.ts";

/**
 * Session data structure (from CLI sync)
 */
export interface SessionData {
  sessionId: string;
  projectPath: string;
  summary?: string;
  messages: Array<{
    type: string;
    content: string;
    timestamp: string;
    toolUse?: unknown;
  }>;
  metadata?: Record<string, unknown>;
}

/**
 * Encrypted session record (stored in database)
 */
export interface EncryptedSessionRecord {
  sessionId: string;
  projectPath: string;
  encryptedContent: string;
  nonce: string;
  authTag: string;
  keyId: string;
  secretsRedacted: boolean;
  redactedSecretTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of encrypting a session
 */
export interface EncryptSessionResult {
  record: EncryptedSessionRecord;
  secretsDetected: boolean;
  redactedSecretCount: number;
  redactedSecretTypes: string[];
}

/**
 * Result of decrypting a session
 */
export interface DecryptSessionResult {
  data: SessionData;
  decryptedAt: Date;
}

/**
 * Export options
 */
export interface ExportOptions {
  /** User-provided passphrase for export encryption */
  passphrase: string;
  /** Include session metadata */
  includeMetadata?: boolean;
}

/**
 * Exported session archive
 */
export interface SessionExport {
  /** Encrypted archive content (base64) */
  encryptedArchive: string;
  /** Nonce for decryption (base64) */
  nonce: string;
  /** Authentication tag (base64) */
  authTag: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Number of sessions included */
  sessionCount: number;
  /** Salt used for key derivation (base64) */
  salt: string;
}

/**
 * Context for operations (passed from middleware)
 */
export interface OperationContext {
  userId: string;
  teamId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Session Encryption Service
 *
 * Central orchestrator for session data security operations.
 */
export class SessionEncryptionService {
  private encryptionService = new EncryptionService();
  private secretDetector = getSecretDetector();
  private auditService = getAuditService();

  /**
   * Initialize the service with master key
   */
  async initialize(masterKey?: string): Promise<void> {
    await this.encryptionService.initialize(masterKey);
  }

  /**
   * Check if encryption is available
   */
  isEncryptionAvailable(): boolean {
    return this.encryptionService.isAvailable();
  }

  /**
   * Encrypt a session for storage
   *
   * Flow:
   * 1. Scan for secrets
   * 2. Redact if found
   * 3. Encrypt content
   * 4. Log audit event
   */
  async encryptSession(
    data: SessionData,
    context: OperationContext
  ): Promise<EncryptSessionResult> {
    // Step 1: Serialize session data
    const contentString = JSON.stringify(data);

    // Step 2: Scan for secrets
    const scanResult = this.secretDetector.scan(contentString);
    const redactedSecretTypes = scanResult.hasSecrets
      ? [...new Set(scanResult.secrets.map((s) => s.type))]
      : [];

    // Log warning if secrets found
    if (scanResult.hasSecrets) {
      console.warn(
        `[SessionEncryptionService] Secrets detected in session ${data.sessionId}: ${redactedSecretTypes.join(", ")}`
      );
    }

    // Step 3: Encrypt (use redacted content if secrets found)
    const contentToEncrypt = scanResult.hasSecrets
      ? scanResult.redactedContent
      : contentString;

    let envelope: EncryptedEnvelope;
    try {
      envelope = await this.encryptionService.encrypt(contentToEncrypt, {
        teamId: context.teamId,
        userId: context.userId,
        aad: data.sessionId, // Bind ciphertext to session ID
      });
    } catch (error) {
      if (error instanceof EncryptionNotAvailableError) {
        // Audit the failure
        await this.auditService.log({
          eventType: "session.sync",
          userId: context.userId,
          teamId: context.teamId,
          metadata: {
            sessionId: data.sessionId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            requestId: context.requestId,
            error: "encryption_not_available",
          },
          success: false,
          errorMessage: "Encryption not available",
        });
        throw error;
      }
      throw error;
    }

    // Step 4: Create record
    const record: EncryptedSessionRecord = {
      sessionId: data.sessionId,
      projectPath: data.projectPath,
      encryptedContent: envelope.ciphertext,
      nonce: envelope.nonce,
      authTag: envelope.authTag,
      keyId: envelope.keyId,
      secretsRedacted: scanResult.hasSecrets,
      redactedSecretTypes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Step 5: Audit log
    await this.auditService.log({
      eventType: "session.sync",
      userId: context.userId,
      teamId: context.teamId,
      metadata: {
        sessionId: data.sessionId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        secretsRedacted: scanResult.hasSecrets,
        redactedCount: scanResult.secretCount,
        keyId: envelope.keyId,
      },
      success: true,
    });

    return {
      record,
      secretsDetected: scanResult.hasSecrets,
      redactedSecretCount: scanResult.secretCount,
      redactedSecretTypes,
    };
  }

  /**
   * Decrypt a session for retrieval
   *
   * Flow:
   * 1. Verify access (done by middleware)
   * 2. Decrypt content
   * 3. Log audit event
   */
  async decryptSession(
    record: EncryptedSessionRecord,
    context: OperationContext
  ): Promise<DecryptSessionResult> {
    // Step 1: Reconstruct envelope
    const envelope: EncryptedEnvelope = {
      ciphertext: record.encryptedContent,
      nonce: record.nonce,
      authTag: record.authTag,
      keyId: record.keyId,
      algorithm: "aes-256-gcm",
    };

    // Step 2: Decrypt
    let decryptedContent: string;
    try {
      decryptedContent = await this.encryptionService.decrypt(envelope, {
        teamId: context.teamId,
        userId: context.userId,
        aad: record.sessionId,
      });
    } catch (error) {
      // Audit the failure
      await this.auditService.log({
        eventType: "session.view",
        userId: context.userId,
        teamId: context.teamId,
        metadata: {
          sessionId: record.sessionId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          error: "decryption_failed",
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : "Decryption failed",
      });
      throw new DecryptionError("Failed to decrypt session data");
    }

    // Step 3: Parse data
    const data = JSON.parse(decryptedContent) as SessionData;

    // Step 4: Log decrypt event
    await this.auditService.log({
      eventType: "encryption.decrypt",
      userId: context.userId,
      teamId: context.teamId,
      metadata: {
        sessionId: record.sessionId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        keyId: record.keyId,
      },
      success: true,
    });

    // Step 5: Log view event
    await this.auditService.log({
      eventType: "session.view",
      userId: context.userId,
      teamId: context.teamId,
      metadata: {
        sessionId: record.sessionId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: true,
    });

    return {
      data,
      decryptedAt: new Date(),
    };
  }

  /**
   * Export sessions for a user
   *
   * Flow:
   * 1. Collect all user's sessions
   * 2. Decrypt each session
   * 3. Package as JSON
   * 4. Re-encrypt with user's passphrase
   * 5. Log audit event
   */
  async exportSessions(
    records: EncryptedSessionRecord[],
    options: ExportOptions,
    context: OperationContext
  ): Promise<SessionExport> {
    // Step 1: Log export request
    await this.auditService.log({
      eventType: "export.request",
      userId: context.userId,
      teamId: context.teamId,
      metadata: {
        sessionCount: records.length,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: true,
    });

    // Step 2: Decrypt all sessions
    const decryptedSessions: SessionData[] = [];
    for (const record of records) {
      try {
        const result = await this.decryptSession(record, context);
        decryptedSessions.push(result.data);
      } catch (error) {
        // Log individual failure but continue with others
        console.warn(
          `[SessionEncryptionService] Failed to decrypt session ${record.sessionId}: ${error}`
        );
      }
    }

    // Step 3: Package as JSON
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: context.userId,
      sessionCount: decryptedSessions.length,
      sessions: decryptedSessions,
    };
    const exportJson = JSON.stringify(exportData, null, 2);

    // Step 4: Derive key from passphrase using PBKDF2
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();
    const passphraseKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(options.passphrase),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations: 100000,
      },
      passphraseKey,
      256
    );

    const exportKey = await crypto.subtle.importKey(
      "raw",
      derivedBits,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    // Step 5: Encrypt the export
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        tagLength: 128,
      },
      exportKey,
      encoder.encode(exportJson)
    );

    // Split ciphertext and auth tag
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    // Step 6: Log export complete
    await this.auditService.log({
      eventType: "export.complete",
      userId: context.userId,
      teamId: context.teamId,
      metadata: {
        sessionCount: decryptedSessions.length,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: true,
    });

    await this.auditService.log({
      eventType: "session.export",
      userId: context.userId,
      teamId: context.teamId,
      metadata: {
        sessionCount: decryptedSessions.length,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: true,
    });

    return {
      encryptedArchive: Buffer.from(ciphertext).toString("base64"),
      nonce: Buffer.from(nonce).toString("base64"),
      authTag: Buffer.from(authTag).toString("base64"),
      exportedAt: new Date(),
      sessionCount: decryptedSessions.length,
      salt: Buffer.from(salt).toString("base64"),
    };
  }
}

/**
 * Error thrown when decryption fails
 */
export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

/**
 * Singleton instance
 */
let _instance: SessionEncryptionService | null = null;

/**
 * Get the session encryption service instance
 */
export function getSessionEncryptionService(): SessionEncryptionService {
  if (!_instance) {
    _instance = new SessionEncryptionService();
  }
  return _instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSessionEncryptionService(): void {
  _instance = null;
}
