/**
 * OAuthConnection GraphQL Type
 *
 * Represents a connection between a user and an OAuth provider.
 */

import { builder } from "../../builder.ts";
import type { OAuthConnection as OAuthConnectionType } from "../../../auth/types.ts";
import { OAuthProviderEnum } from "./auth-user.ts";

/**
 * OAuthConnection type ref
 */
export const OAuthConnectionRef = builder.objectRef<OAuthConnectionType>("OAuthConnection");

/**
 * OAuthConnection type implementation
 */
export const OAuthConnectionTypeImpl = OAuthConnectionRef.implement({
	description: "A connection between a user and an OAuth provider",
	fields: (t) => ({
		id: t.exposeID("id", {
			description: "Unique connection identifier",
		}),
		provider: t.field({
			type: OAuthProviderEnum,
			description: "The OAuth provider (GITHUB, GITLAB)",
			resolve: (conn) => conn.provider,
		}),
		providerUsername: t.string({
			nullable: true,
			description: "Username on the OAuth provider",
			resolve: (conn) => conn.providerUsername,
		}),
		providerEmail: t.string({
			nullable: true,
			description: "Email from the OAuth provider",
			resolve: (conn) => conn.providerEmail,
		}),
		connectedAt: t.field({
			type: "DateTime",
			description: "When this provider was connected",
			resolve: (conn) => conn.createdAt,
		}),
		hasValidToken: t.boolean({
			description: "Whether the stored token is still valid",
			resolve: (conn) => {
				// Check if token has expired
				if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date()) {
					return false;
				}
				return true;
			},
		}),
		scopes: t.stringList({
			description: "OAuth scopes granted to this connection",
			resolve: (conn) => conn.scopes,
		}),
	}),
});

// Export as named type
export { OAuthConnectionTypeImpl as OAuthConnectionType };
