/**
 * GraphQL Permissions type
 *
 * Claude permissions configuration.
 */

import { getPermissions } from "../../api/settings.ts";
import { builder } from "../builder.ts";

/**
 * Permissions data
 */
export interface PermissionsData {
	allowedTools: string[];
	deniedTools: string[];
	additionalDirectories: string[];
}

/**
 * Permissions type ref
 */
const PermissionsRef = builder.objectRef<PermissionsData>("Permissions");

/**
 * Permissions type implementation
 */
export const PermissionsType = PermissionsRef.implement({
	description: "Claude permissions configuration",
	fields: (t) => ({
		allowedTools: t.stringList({
			description: "List of allowed tools",
			resolve: (p) => p.allowedTools,
		}),
		deniedTools: t.stringList({
			description: "List of denied tools",
			resolve: (p) => p.deniedTools,
		}),
		additionalDirectories: t.stringList({
			description: "Additional allowed directories",
			resolve: (p) => p.additionalDirectories,
		}),
	}),
});

/**
 * Query permissions
 */
export function queryPermissions(): PermissionsData {
	return getPermissions();
}
