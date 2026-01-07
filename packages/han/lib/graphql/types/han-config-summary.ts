/**
 * GraphQL HanConfigSummary type
 *
 * Summary of Han user configuration.
 */

import { builder } from "../builder.ts";

/**
 * Han config summary data
 */
export interface HanConfigSummaryData {
	path: string;
	exists: boolean;
	lastModified: string | null;
	hooksEnabled: boolean;
	memoryEnabled: boolean;
	metricsEnabled: boolean;
	pluginConfigCount: number;
}

/**
 * Han config summary type ref
 */
const HanConfigSummaryRef =
	builder.objectRef<HanConfigSummaryData>("HanConfigSummary");

/**
 * Han config summary type implementation
 */
export const HanConfigSummaryType = HanConfigSummaryRef.implement({
	description: "Summary of Han user configuration",
	fields: (t) => ({
		path: t.exposeString("path", {
			description: "Path to config file",
		}),
		exists: t.exposeBoolean("exists", {
			description: "Whether the config file exists",
		}),
		lastModified: t.string({
			nullable: true,
			description: "Last modification time",
			resolve: (s) => s.lastModified,
		}),
		hooksEnabled: t.exposeBoolean("hooksEnabled", {
			description: "Whether hooks are enabled",
		}),
		memoryEnabled: t.exposeBoolean("memoryEnabled", {
			description: "Whether memory is enabled",
		}),
		metricsEnabled: t.exposeBoolean("metricsEnabled", {
			description: "Whether metrics tracking is enabled",
		}),
		pluginConfigCount: t.exposeInt("pluginConfigCount", {
			description: "Number of plugins with custom configuration",
		}),
	}),
});
