/**
 * Magic Link Email Authentication
 *
 * Passwordless authentication via email magic links.
 * Tokens are cryptographically secure and expire after 15 minutes.
 */

import { generateSecureToken, hashSHA256 } from './encryption.ts';
import type { MagicLinkResult, MagicLinkToken } from './types.ts';

/**
 * Magic link token expiry: 15 minutes
 */
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

/**
 * In-memory token store for development
 * In production, this should be backed by a database
 */
const tokenStore = new Map<string, MagicLinkToken>();

/**
 * Email sending interface
 * Implementations can use Resend, SendGrid, etc.
 */
export interface EmailProvider {
  sendMagicLink(email: string, link: string): Promise<boolean>;
}

/**
 * Console email provider for development
 */
export class ConsoleEmailProvider implements EmailProvider {
  async sendMagicLink(email: string, link: string): Promise<boolean> {
    console.log(`\n========================================`);
    console.log(`Magic link for ${email}:`);
    console.log(link);
    console.log(`========================================\n`);
    return true;
  }
}

/**
 * Resend email provider
 */
export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async sendMagicLink(email: string, link: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: email,
          subject: 'Sign in to Han',
          html: `
						<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
							<h1 style="color: #333;">Sign in to Han</h1>
							<p>Click the button below to sign in to your Han account.</p>
							<a href="${link}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
								Sign In
							</a>
							<p style="color: #666; font-size: 14px;">
								This link expires in 15 minutes.
							</p>
							<p style="color: #999; font-size: 12px;">
								If you didn't request this email, you can safely ignore it.
							</p>
						</div>
					`,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Get the email provider based on environment
 */
export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.EMAIL_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'noreply@han.guru';

  if (apiKey && process.env.EMAIL_PROVIDER === 'resend') {
    return new ResendEmailProvider(apiKey, fromEmail);
  }

  return new ConsoleEmailProvider();
}

/**
 * Generate a magic link token
 *
 * @param email - Email address to send the link to
 * @returns Token record
 */
export function generateMagicLinkToken(email: string): MagicLinkToken {
  const token = generateSecureToken(32);
  const tokenHash = hashSHA256(token);
  const now = new Date();

  const record: MagicLinkToken = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    tokenHash,
    expiresAt: new Date(now.getTime() + TOKEN_EXPIRY_MS),
    usedAt: null,
    createdAt: now,
  };

  // Store by hash for lookup
  tokenStore.set(tokenHash, record);

  // Attach raw token for URL generation (not stored in DB)
  return { ...record, tokenHash: token };
}

/**
 * Verify a magic link token
 *
 * @param token - Raw token from URL
 * @returns Token record if valid, null if invalid/expired
 */
export function verifyMagicLinkToken(token: string): MagicLinkToken | null {
  const tokenHash = hashSHA256(token);
  const record = tokenStore.get(tokenHash);

  if (!record) {
    return null;
  }

  // Check if expired
  if (record.expiresAt < new Date()) {
    tokenStore.delete(tokenHash);
    return null;
  }

  // Check if already used
  if (record.usedAt) {
    return null;
  }

  return record;
}

/**
 * Mark a magic link token as used
 *
 * @param token - Raw token from URL
 * @returns true if marked successfully
 */
export function consumeMagicLinkToken(token: string): boolean {
  const tokenHash = hashSHA256(token);
  const record = tokenStore.get(tokenHash);

  if (!record || record.usedAt) {
    return false;
  }

  record.usedAt = new Date();
  return true;
}

/**
 * Request a magic link
 *
 * @param email - Email address
 * @param baseUrl - Base URL for the magic link (e.g., https://han.guru)
 * @param emailProvider - Email provider to use
 * @returns Result with success status
 */
export async function requestMagicLink(
  email: string,
  baseUrl: string,
  emailProvider?: EmailProvider
): Promise<MagicLinkResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // Basic email validation
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return {
      success: false,
      message: 'Invalid email address',
    };
  }

  // Generate token
  const tokenRecord = generateMagicLinkToken(normalizedEmail);

  // Build magic link URL
  const magicLink = `${baseUrl}/auth/verify?token=${tokenRecord.tokenHash}`;

  // Send email
  const provider = emailProvider || getEmailProvider();
  const sent = await provider.sendMagicLink(normalizedEmail, magicLink);

  if (!sent) {
    return {
      success: false,
      message: 'Failed to send email',
    };
  }

  return {
    success: true,
    message: 'Magic link sent to your email',
  };
}

/**
 * Clean up expired tokens (should be called periodically)
 */
export function cleanupExpiredTokens(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [hash, record] of tokenStore.entries()) {
    if (record.expiresAt < now) {
      tokenStore.delete(hash);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get token store size (for monitoring)
 */
export function getTokenStoreSize(): number {
  return tokenStore.size;
}
