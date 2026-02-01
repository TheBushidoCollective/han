/**
 * GitLab OAuth Integration
 *
 * Implements GitLab OAuth 2.0 with PKCE support.
 * Supports both GitLab.com and self-hosted instances.
 */

import type { AuthConfig, OAuthCallbackResult } from "../types.ts";
import {
	generateCodeChallenge,
	generateCodeVerifier,
	generateState,
} from "./pkce.ts";

/**
 * Default GitLab instance URL
 */
const DEFAULT_GITLAB_URL = "https://gitlab.com";

/**
 * Default scopes for GitLab OAuth
 * - read_user: Read user profile
 * - read_api: Read API (needed for repo data sync)
 * - read_repository: Read repository content
 */
const DEFAULT_SCOPES = ["read_user", "read_api", "read_repository"];

/**
 * GitLab user profile from API
 */
interface GitLabUser {
	id: number;
	username: string;
	email: string;
	name: string;
	avatar_url: string;
	state: string;
}

/**
 * Get GitLab instance URL from config
 */
function getGitLabUrl(config: AuthConfig): string {
	return config.gitlabInstanceUrl || DEFAULT_GITLAB_URL;
}

/**
 * Generate GitLab authorization URL with PKCE
 *
 * @param config - Auth configuration
 * @param scopes - Optional custom scopes
 * @returns Authorization URL, state, and code verifier
 */
export function initiateGitLabOAuth(
	config: AuthConfig,
	scopes: string[] = DEFAULT_SCOPES,
): { authorizationUrl: string; state: string; codeVerifier: string } {
	if (!config.gitlabClientId) {
		throw new Error("GitLab client ID is not configured");
	}

	const gitlabUrl = getGitLabUrl(config);
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);

	const params = new URLSearchParams({
		client_id: config.gitlabClientId,
		redirect_uri: `${config.oauthCallbackUrl}/auth/callback/gitlab`,
		response_type: "code",
		scope: scopes.join(" "),
		state,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
	});

	return {
		authorizationUrl: `${gitlabUrl}/oauth/authorize?${params.toString()}`,
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
export async function completeGitLabOAuth(
	code: string,
	codeVerifier: string,
	config: AuthConfig,
): Promise<OAuthCallbackResult> {
	if (!config.gitlabClientId || !config.gitlabClientSecret) {
		throw new Error("GitLab OAuth credentials are not configured");
	}

	const gitlabUrl = getGitLabUrl(config);

	// Exchange code for tokens
	const tokenResponse = await fetch(`${gitlabUrl}/oauth/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({
			client_id: config.gitlabClientId,
			client_secret: config.gitlabClientSecret,
			code,
			grant_type: "authorization_code",
			redirect_uri: `${config.oauthCallbackUrl}/auth/callback/gitlab`,
			code_verifier: codeVerifier,
		}),
	});

	if (!tokenResponse.ok) {
		const error = await tokenResponse.text();
		throw new Error(`GitLab token exchange failed: ${error}`);
	}

	const tokenData = await tokenResponse.json();

	if (tokenData.error) {
		throw new Error(
			`GitLab OAuth error: ${tokenData.error_description || tokenData.error}`,
		);
	}

	const accessToken = tokenData.access_token;
	const refreshToken = tokenData.refresh_token || null;
	const expiresIn = tokenData.expires_in;
	const scopes = (tokenData.scope || "").split(" ").filter(Boolean);

	// Fetch user info
	const userResponse = await fetch(`${gitlabUrl}/api/v4/user`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
		},
	});

	if (!userResponse.ok) {
		throw new Error("Failed to fetch GitLab user info");
	}

	const user: GitLabUser = await userResponse.json();

	return {
		provider: "gitlab",
		providerUserId: String(user.id),
		providerEmail: user.email,
		providerUsername: user.username,
		accessToken,
		refreshToken,
		tokenExpiresAt: expiresIn
			? new Date(Date.now() + expiresIn * 1000)
			: null,
		scopes,
	};
}

/**
 * Refresh a GitLab access token
 *
 * @param refreshToken - Refresh token
 * @param config - Auth configuration
 * @returns New token data or null if failed
 */
export async function refreshGitLabToken(
	refreshToken: string,
	config: AuthConfig,
): Promise<{
	accessToken: string;
	refreshToken: string | null;
	expiresAt: Date | null;
} | null> {
	if (!config.gitlabClientId || !config.gitlabClientSecret) {
		throw new Error("GitLab OAuth credentials are not configured");
	}

	const gitlabUrl = getGitLabUrl(config);

	try {
		const response = await fetch(`${gitlabUrl}/oauth/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				client_id: config.gitlabClientId,
				client_secret: config.gitlabClientSecret,
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
 * Revoke a GitLab access token
 *
 * @param token - Token to revoke
 * @param config - Auth configuration
 * @returns true if successful
 */
export async function revokeGitLabToken(
	token: string,
	config: AuthConfig,
): Promise<boolean> {
	if (!config.gitlabClientId || !config.gitlabClientSecret) {
		return false;
	}

	const gitlabUrl = getGitLabUrl(config);

	try {
		const response = await fetch(`${gitlabUrl}/oauth/revoke`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				client_id: config.gitlabClientId,
				client_secret: config.gitlabClientSecret,
				token,
			}),
		});

		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Validate a GitLab access token is still valid
 *
 * @param token - Token to validate
 * @param config - Auth configuration (for instance URL)
 * @returns true if valid
 */
export async function validateGitLabToken(
	token: string,
	config: AuthConfig,
): Promise<boolean> {
	const gitlabUrl = getGitLabUrl(config);

	try {
		const response = await fetch(`${gitlabUrl}/api/v4/user`, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			},
		});
		return response.ok;
	} catch {
		return false;
	}
}
