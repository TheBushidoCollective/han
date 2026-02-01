/**
 * PKCE (Proof Key for Code Exchange) Utilities
 *
 * Implements RFC 7636 for secure OAuth 2.0 authorization code flow.
 * Uses S256 challenge method (SHA-256 hash of code verifier).
 */

import { createHash, randomBytes } from "node:crypto";

/**
 * Generate a cryptographically random code verifier
 * Length: 43-128 characters (we use 64 for a good balance)
 *
 * @returns URL-safe base64 encoded verifier
 */
export function generateCodeVerifier(): string {
	// 48 bytes = 64 base64 characters
	return randomBytes(48)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/**
 * Generate the code challenge from a code verifier
 * Uses S256 method: BASE64URL(SHA256(code_verifier))
 *
 * @param verifier - The code verifier string
 * @returns URL-safe base64 encoded challenge
 */
export function generateCodeChallenge(verifier: string): string {
	return createHash("sha256")
		.update(verifier)
		.digest("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/**
 * Generate a random state parameter for CSRF protection
 *
 * @returns URL-safe base64 encoded state
 */
export function generateState(): string {
	return randomBytes(32)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/**
 * Verify that a code verifier matches a code challenge
 * Used server-side to validate the authorization flow
 *
 * @param verifier - The original code verifier
 * @param challenge - The expected code challenge
 * @returns true if they match
 */
export function verifyCodeChallenge(
	verifier: string,
	challenge: string,
): boolean {
	const computed = generateCodeChallenge(verifier);
	return computed === challenge;
}

/**
 * PKCE parameters for an OAuth authorization request
 */
export interface PKCEParams {
	codeVerifier: string;
	codeChallenge: string;
	codeChallengeMethod: "S256";
	state: string;
}

/**
 * Generate all PKCE parameters for a new authorization flow
 *
 * @returns Complete PKCE parameters
 */
export function generatePKCEParams(): PKCEParams {
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);

	return {
		codeVerifier,
		codeChallenge,
		codeChallengeMethod: "S256",
		state: generateState(),
	};
}
