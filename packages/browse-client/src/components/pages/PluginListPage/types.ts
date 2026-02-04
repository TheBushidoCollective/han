/**
 * Plugins Page Types
 *
 * Shared interfaces for plugins page components.
 */

export interface Plugin {
	id: string;
	name: string;
	marketplace: string;
	scope: "USER" | "PROJECT" | "LOCAL";
	enabled: boolean;
	category: string;
}

export interface PluginsData {
	viewer: {
		plugins: Plugin[];
		pluginStats: {
			totalPlugins: number;
			userPlugins: number;
			projectPlugins: number;
			localPlugins: number;
			enabledPlugins: number;
		};
		pluginCategories: Array<{
			category: string;
			count: number;
		}>;
	};
}

export interface MutationResult {
	togglePlugin?: { success: boolean; message: string };
	removePlugin?: { success: boolean; message: string };
}
