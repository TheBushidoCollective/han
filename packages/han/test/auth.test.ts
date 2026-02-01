/**
 * Authentication Module Tests
 */

import { describe, expect, test, beforeEach } from "bun:test";
import {
	// JWT
	createTokenPair,
	verifyAccessToken,
	verifyRefreshToken,
	getTokenHash,
	isTokenExpired,
	generateJWTSecret,
	// Encryption
	encrypt,
	decrypt,
	generateEncryptionKey,
	hashSHA256,
	generateSecureToken,
	// PKCE
	generateCodeVerifier,
	generateCodeChallenge,
	verifyCodeChallenge,
	generatePKCEParams,
	generateState,
	// Rate limiter
	checkRateLimit,
	recordAttempt,
	resetRateLimit,
	RATE_LIMIT_CONFIGS,
	// Types
	type AuthConfig,
} from "../lib/auth/index.ts";

// Test configuration
const testConfig: AuthConfig = {
	jwtSecret: generateJWTSecret(),
	jwtIssuer: "https://test.han.guru",
	encryptionKey: generateEncryptionKey(),
	accessTokenExpiry: 60, // 1 minute for tests
	refreshTokenExpiry: 300, // 5 minutes for tests
	oauthCallbackUrl: "https://test.han.guru/auth/callback",
};

describe("JWT Utilities", () => {
	test("createTokenPair generates valid tokens", async () => {
		const userId = "user-123";
		const sessionId = "session-456";

		const tokens = await createTokenPair(userId, sessionId, testConfig, "test@example.com");

		expect(tokens.accessToken).toBeDefined();
		expect(tokens.refreshToken).toBeDefined();
		expect(tokens.accessTokenExpiresAt).toBeInstanceOf(Date);
		expect(tokens.refreshTokenExpiresAt).toBeInstanceOf(Date);
		expect(tokens.accessTokenExpiresAt < tokens.refreshTokenExpiresAt).toBe(true);
	});

	test("verifyAccessToken validates correctly", async () => {
		const userId = "user-123";
		const sessionId = "session-456";

		const tokens = await createTokenPair(userId, sessionId, testConfig);
		const payload = await verifyAccessToken(tokens.accessToken, testConfig);

		expect(payload).not.toBeNull();
		expect(payload?.sub).toBe(userId);
		expect(payload?.sid).toBe(sessionId);
		expect(payload?.type).toBe("access");
	});

	test("verifyRefreshToken validates correctly", async () => {
		const userId = "user-123";
		const sessionId = "session-456";

		const tokens = await createTokenPair(userId, sessionId, testConfig);
		const payload = await verifyRefreshToken(tokens.refreshToken, testConfig);

		expect(payload).not.toBeNull();
		expect(payload?.sub).toBe(userId);
		expect(payload?.sid).toBe(sessionId);
		expect(payload?.type).toBe("refresh");
	});

	test("verifyAccessToken rejects refresh tokens", async () => {
		const tokens = await createTokenPair("user-123", "session-456", testConfig);
		const payload = await verifyAccessToken(tokens.refreshToken, testConfig);

		expect(payload).toBeNull();
	});

	test("verifyRefreshToken rejects access tokens", async () => {
		const tokens = await createTokenPair("user-123", "session-456", testConfig);
		const payload = await verifyRefreshToken(tokens.accessToken, testConfig);

		expect(payload).toBeNull();
	});

	test("getTokenHash produces consistent hash", () => {
		const token = "test-token-123";
		const hash1 = getTokenHash(token);
		const hash2 = getTokenHash(token);

		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64); // SHA-256 hex length
	});

	test("isTokenExpired detects expired tokens", async () => {
		// Create a token that expires in 1 second
		const shortConfig = { ...testConfig, accessTokenExpiry: 1 };
		const tokens = await createTokenPair("user", "session", shortConfig);

		// Wait for it to expire
		await new Promise((r) => setTimeout(r, 1100));

		expect(isTokenExpired(tokens.accessToken)).toBe(true);
	});

	test("generateJWTSecret creates 64-char hex string", () => {
		const secret = generateJWTSecret();

		expect(secret).toHaveLength(64);
		expect(/^[0-9a-f]{64}$/.test(secret)).toBe(true);
	});
});

describe("Encryption Utilities", () => {
	const key = generateEncryptionKey();

	test("encrypt/decrypt round trip", () => {
		const plaintext = "my-secret-oauth-token-12345";

		const encrypted = encrypt(plaintext, key);
		const decrypted = decrypt(encrypted, key);

		expect(decrypted).toBe(plaintext);
	});

	test("encrypt produces different ciphertext each time (unique IV)", () => {
		const plaintext = "same-plaintext";

		const encrypted1 = encrypt(plaintext, key);
		const encrypted2 = encrypt(plaintext, key);

		// Same plaintext should produce different ciphertext due to random IV
		expect(encrypted1.equals(encrypted2)).toBe(false);
	});

	test("decrypt fails with wrong key", () => {
		const plaintext = "secret";
		const wrongKey = generateEncryptionKey();

		const encrypted = encrypt(plaintext, key);

		expect(() => decrypt(encrypted, wrongKey)).toThrow();
	});

	test("generateEncryptionKey creates 64-char hex string", () => {
		const key = generateEncryptionKey();

		expect(key).toHaveLength(64);
		expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
	});

	test("hashSHA256 produces consistent hash", () => {
		const value = "test-value";
		const hash1 = hashSHA256(value);
		const hash2 = hashSHA256(value);

		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64);
	});

	test("generateSecureToken produces URL-safe tokens", () => {
		const token = generateSecureToken(32);

		// Should not contain + / or =
		expect(token).not.toMatch(/[+/=]/);
		// Should be base64url characters
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});

describe("PKCE Utilities", () => {
	test("generateCodeVerifier creates valid verifier", () => {
		const verifier = generateCodeVerifier();

		// Should be between 43-128 characters
		expect(verifier.length).toBeGreaterThanOrEqual(43);
		expect(verifier.length).toBeLessThanOrEqual(128);
		// Should be URL-safe
		expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	test("generateCodeChallenge creates S256 challenge", () => {
		const verifier = "test-verifier-12345";
		const challenge = generateCodeChallenge(verifier);

		// Should be URL-safe base64
		expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
		// Should be 43 chars for SHA-256 base64url
		expect(challenge).toHaveLength(43);
	});

	test("verifyCodeChallenge validates correctly", () => {
		const verifier = generateCodeVerifier();
		const challenge = generateCodeChallenge(verifier);

		expect(verifyCodeChallenge(verifier, challenge)).toBe(true);
		expect(verifyCodeChallenge("wrong-verifier", challenge)).toBe(false);
	});

	test("generatePKCEParams returns complete params", () => {
		const params = generatePKCEParams();

		expect(params.codeVerifier).toBeDefined();
		expect(params.codeChallenge).toBeDefined();
		expect(params.codeChallengeMethod).toBe("S256");
		expect(params.state).toBeDefined();
	});

	test("generateState creates URL-safe state", () => {
		const state = generateState();

		expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(state.length).toBeGreaterThanOrEqual(32);
	});
});

describe("Rate Limiter", () => {
	const testKey = "test:rate-limit";
	const testConfig = {
		maxAttempts: 3,
		windowMs: 1000,
		blockDurationMs: 2000,
		maxBlockDurationMs: 10000,
	};

	beforeEach(() => {
		resetRateLimit(testKey);
	});

	test("allows requests under limit", () => {
		const result = checkRateLimit(testKey, testConfig);

		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(3);
	});

	test("tracks attempts correctly", () => {
		recordAttempt(testKey, testConfig, true);
		recordAttempt(testKey, testConfig, true);

		const result = checkRateLimit(testKey, testConfig);

		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(1);
	});

	test("blocks after max attempts", () => {
		recordAttempt(testKey, testConfig, false);
		recordAttempt(testKey, testConfig, false);
		recordAttempt(testKey, testConfig, false);

		const result = checkRateLimit(testKey, testConfig);

		expect(result.allowed).toBe(false);
		expect(result.retryAfterMs).toBeGreaterThan(0);
	});

	test("resetRateLimit clears limit", () => {
		recordAttempt(testKey, testConfig, false);
		recordAttempt(testKey, testConfig, false);
		recordAttempt(testKey, testConfig, false);

		resetRateLimit(testKey);

		const result = checkRateLimit(testKey, testConfig);
		expect(result.allowed).toBe(true);
	});

	test("default configs are defined", () => {
		expect(RATE_LIMIT_CONFIGS.magicLink).toBeDefined();
		expect(RATE_LIMIT_CONFIGS.oauthInitiate).toBeDefined();
		expect(RATE_LIMIT_CONFIGS.loginAttempt).toBeDefined();
		expect(RATE_LIMIT_CONFIGS.sessionRefresh).toBeDefined();
	});
});
