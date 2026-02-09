/**
 * OAuth Flow Orchestration
 *
 * Unified interface for initiating and completing OAuth flows
 * across multiple providers (GitHub, GitLab).
 */

import type {
  AuthConfig,
  OAuthCallbackResult,
  OAuthInitiateResult,
  OAuthProvider,
} from '../types.ts';
import {
  completeGitHubOAuth,
  initiateGitHubOAuth,
  refreshGitHubToken,
  revokeGitHubToken,
  validateGitHubToken,
} from './github.ts';
import {
  completeGitLabOAuth,
  initiateGitLabOAuth,
  refreshGitLabToken,
  revokeGitLabToken,
  validateGitLabToken,
} from './gitlab.ts';

// Re-export provider-specific functions
export {
  completeGitHubOAuth,
  initiateGitHubOAuth,
  refreshGitHubToken,
  revokeGitHubToken,
  validateGitHubToken,
} from './github.ts';
export {
  completeGitLabOAuth,
  initiateGitLabOAuth,
  refreshGitLabToken,
  revokeGitLabToken,
  validateGitLabToken,
} from './gitlab.ts';
// Re-export PKCE utilities
export * from './pkce.ts';

/**
 * Initiate OAuth flow for any supported provider
 *
 * @param provider - OAuth provider (github, gitlab)
 * @param config - Auth configuration
 * @param scopes - Optional custom scopes
 * @returns OAuth initiation result with auth URL and PKCE params
 */
export function initiateOAuth(
  provider: OAuthProvider,
  config: AuthConfig,
  scopes?: string[]
): OAuthInitiateResult {
  switch (provider) {
    case 'github': {
      const result = initiateGitHubOAuth(config, scopes);
      return {
        authorizationUrl: result.authorizationUrl,
        state: result.state,
        codeVerifier: result.codeVerifier,
      };
    }
    case 'gitlab': {
      const result = initiateGitLabOAuth(config, scopes);
      return {
        authorizationUrl: result.authorizationUrl,
        state: result.state,
        codeVerifier: result.codeVerifier,
      };
    }
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}

/**
 * Complete OAuth flow for any supported provider
 *
 * @param provider - OAuth provider
 * @param code - Authorization code
 * @param codeVerifier - PKCE code verifier
 * @param config - Auth configuration
 * @returns OAuth callback result with user info and tokens
 */
export async function completeOAuth(
  provider: OAuthProvider,
  code: string,
  codeVerifier: string,
  config: AuthConfig
): Promise<OAuthCallbackResult> {
  switch (provider) {
    case 'github':
      return completeGitHubOAuth(code, codeVerifier, config);
    case 'gitlab':
      return completeGitLabOAuth(code, codeVerifier, config);
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}

/**
 * Refresh OAuth token for any supported provider
 *
 * @param provider - OAuth provider
 * @param refreshToken - Refresh token
 * @param config - Auth configuration
 * @returns New token data or null
 */
export async function refreshOAuthToken(
  provider: OAuthProvider,
  refreshToken: string,
  config: AuthConfig
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
} | null> {
  switch (provider) {
    case 'github':
      return refreshGitHubToken(refreshToken, config);
    case 'gitlab':
      return refreshGitLabToken(refreshToken, config);
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}

/**
 * Revoke OAuth token for any supported provider
 *
 * @param provider - OAuth provider
 * @param token - Token to revoke
 * @param config - Auth configuration
 * @returns true if successful
 */
export async function revokeOAuthToken(
  provider: OAuthProvider,
  token: string,
  config: AuthConfig
): Promise<boolean> {
  switch (provider) {
    case 'github':
      return revokeGitHubToken(token, config);
    case 'gitlab':
      return revokeGitLabToken(token, config);
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}

/**
 * Validate OAuth token for any supported provider
 *
 * @param provider - OAuth provider
 * @param token - Token to validate
 * @param config - Auth configuration
 * @returns true if valid
 */
export async function validateOAuthToken(
  provider: OAuthProvider,
  token: string,
  config: AuthConfig
): Promise<boolean> {
  switch (provider) {
    case 'github':
      return validateGitHubToken(token);
    case 'gitlab':
      return validateGitLabToken(token, config);
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: OAuthProvider): string {
  switch (provider) {
    case 'github':
      return 'GitHub';
    case 'gitlab':
      return 'GitLab';
    default:
      return provider;
  }
}

/**
 * Check if a provider is configured
 */
export function isProviderConfigured(
  provider: OAuthProvider,
  config: AuthConfig
): boolean {
  switch (provider) {
    case 'github':
      return Boolean(config.githubClientId && config.githubClientSecret);
    case 'gitlab':
      return Boolean(config.gitlabClientId && config.gitlabClientSecret);
    default:
      return false;
  }
}

/**
 * Get list of configured providers
 */
export function getConfiguredProviders(config: AuthConfig): OAuthProvider[] {
  const providers: OAuthProvider[] = [];

  if (isProviderConfigured('github', config)) {
    providers.push('github');
  }
  if (isProviderConfigured('gitlab', config)) {
    providers.push('gitlab');
  }

  return providers;
}
