/**
 * GraphQL PluginScope enum
 *
 * Scope where plugin is installed.
 */

import { builder } from "../../builder.ts";

/**
 * Plugin scope enum
 */
export const PluginScopeEnum = builder.enumType("PluginScope", {
	values: ["USER", "PROJECT", "LOCAL"] as const,
	description: "Scope where plugin is installed",
});
