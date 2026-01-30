/**
 * GitHub OAuth Integration
 *
 * Implements GitHub OAuth 2.0 with PKCE support.
 * Uses oauth4webapi for standards-compliant implementation.
 */

import * as oauth from "oauth4webapi";
import type { AuthConfig, OAuthCallbackResult } from "../types.ts";
import {
	generateCodeChallenge,
	generateCodeVerifier,
	generateState,
} from "./pkce.ts";

/**
 * GitHub OAuth configuration
 */
const GITHUB_ISSUER = "https://github.com";
const GITHUB_AUTH_ENDPOINT = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const GITHUB_API_BASE = "https://api.github.com";

/**
 * Default scopes for GitHub OAuth
 * - read:user: Read user profile
 * - read:org: Read organization membership
 * - repo: Full repository access (needed for private repo data sync)
 */
const DEFAULT_SCOPES = ["read:user", "read:org", "repo"];

/**
 * GitHub user profile from API
 */
interface GitHubUser {
	id: number;
	login: string;
	email: string | null;
	name: string | null;
	avatar_url: string;
}

/**
 * GitHub email from API
 */
interface GitHubEmail {
	email: string;
	primary: boolean;
	verified: boolean;
}

/**
 * Generate GitHub authorization URL with PKCE
 *
 * @param config - Auth configuration
 * @param scopes - Optional custom scopes (default: read:user, read:org, repo)
 * @returns Authorization URL, state, and code verifier
 */
export function initiateGitHubOAuth(
	config: AuthConfig,
	scopes: string[] = DEFAULT_SCOPES,
): { authorizationUrl: string; state: string; codeVerifier: string } {
	if (!config.githubClientId) {
		throw new Error("GitHub client ID is not configured");
	}

	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);

	const params = new URLSearchParams({
		client_id: config.githubClientId,
		redirect_uri: `${config.oauthCallbackUrl}/auth/callback/github`,
		scope: scopes.join(" "),
		state,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
	});

	return {
		authorizationUrl: `${GITHUB_AUTH_ENDPOINT}?${params.toString()}`,
		state,
		codeVerifier,
	};
}

/**
 * Exchange authorization code for tokens and fetch user info
 *
 * @param code - Authorization code from callback
 * @param codeVerifier - Original PKCE code verifier
 * @param config - Auth configuration
 * @returns OAuth callback result with user info and tokens
 */
export async function completeGitHubOAuth(
	code: string,
	codeVerifier: string,
	config: AuthConfig,
): Promise<OAuthCallbackResult> {
	if (!config.githubClientId || !config.githubClientSecret) {
		throw new Error("GitHub OAuth credentials are not configured");
	}

	// Exchange code for tokens
	const tokenResponse = await fetch(GITHUB_TOKEN_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({
			client_id: config.githubClientId,
			client_secret: config.githubClientSecret,
			code,
			redirect_uri: `${config.oauthCallbackUrl}/auth/callback/github`,
			code_verifier: codeVerifier,
		}),
	});

	if (!tokenResponse.ok) {
		const error = await tokenResponse.text();
		throw new Error(`GitHub token exchange failed: ${error}`);
	}

	const tokenData = await tokenResponse.json();

	if (tokenData.error) {
		throw new Error(
			`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`,
		);
	}

	const accessToken = tokenData.access_token;
	const refreshToken = tokenData.refresh_token || null;
	const expiresIn = tokenData.expires_in;
	const scopes = (tokenData.scope || "").split(",").filter(Boolean);

	// Fetch user info
	const userResponse = await fetch(`${GITHUB_API_BASE}/user`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/vnd.github.v3+json",
		},
	});

	if (!userResponse.ok) {
		throw new Error("Failed to fetch GitHub user info");
	}

	const user: GitHubUser = await userResponse.json();

	// Fetch primary email if not provided
	let email = user.email;
	if (!email) {
		const emailsResponse = await fetch(`${GITHUB_API_BASE}/user/emails`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/vnd.github.v3+json",
			},
		});

		if (emailsResponse.ok) {
			const emails: GitHubEmail[] = await emailsResponse.json();
			const primaryEmail = emails.find((e) => e.primary && e.verified);
			email = primaryEmail?.email || emails[0]?.email || null;
		}
	}

	return {
		provider: "github",
		providerUserId: String(user.id),
		providerEmail: email,
		providerUsername: user.login,
		accessToken,
		refreshToken,
		tokenExpiresAt: expiresIn
			? new Date(Date.now() + expiresIn * 1000)
			: null,
		scopes,
	};
}

/**
 * Refresh a GitHub access token
 * Note: GitHub does not support refresh tokens by default.
 * This is included for future compatibility.
 *
 * @param refreshToken - Refresh token
 * @param config - Auth configuration
 * @returns New token data or null if not supported
 */
export async function refreshGitHubToken(
	refreshToken: string,
	config: AuthConfig,
): Promise<{
	accessToken: string;
	refreshToken: string | null;
	expiresAt: Date | null;
} | null> {
	if (!config.githubClientId || !config.githubClientSecret) {
		throw new Error("GitHub OAuth credentials are not configured");
	}

	try {
		const response = await fetch(GITHUB_TOKEN_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				client_id: config.githubClientId,
				client_secret: config.githubClientSecret,
				grant_type: "refresh_token",
				refresh_token: refreshToken,
			}),
		});

		if (!response.ok) {
			return null;
		}

		const data = await response.json();

		if (data.error) {
			return null;
		}

		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token || null,
			expiresAt: data.expires_in
				? new Date(Date.now() + data.expires_in * 1000)
				: null,
		};
	} catch {
		return null;
	}
}

/**
 * Revoke a GitHub access token
 *
 * @param token - Token to revoke
 * @param config - Auth configuration
 * @returns true if successful
 */
export async function revokeGitHubToken(
	token: string,
	config: AuthConfig,
): Promise<boolean> {
	if (!config.githubClientId || !config.githubClientSecret) {
		return false;
	}

	try {
		const response = await fetch(
			`${GITHUB_API_BASE}/applications/${config.githubClientId}/token`,
			{
				method: "DELETE",
				headers: {
					Authorization: `Basic ${Buffer.from(
						`${config.githubClientId}:${config.githubClientSecret}`,
					).toString("base64")}`,
					Accept: "application/vnd.github.v3+json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ access_token: token }),
			},
		);

		return response.status === 204;
	} catch {
		return false;
	}
}

/**
 * Validate a GitHub access token is still valid
 *
 * @param token - Token to validate
 * @returns true if valid
 */
export async function validateGitHubToken(token: string): Promise<boolean> {
	try {
		const response = await fetch(`${GITHUB_API_BASE}/user`, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github.v3+json",
			},
		});
		return response.ok;
	} catch {
		return false;
	}
}
