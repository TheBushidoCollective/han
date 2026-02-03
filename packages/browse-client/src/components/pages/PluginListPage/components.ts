/**
 * Plugins Page Components
 *
 * Extracted components for the plugins page.
 */

export { StatCard } from "@/components/organisms/StatCard.tsx";
export { PluginCard } from "./PluginCard.tsx";
export type { MutationResult, Plugin, PluginsData } from "./types.ts";
export {
	formatScope,
	getCategoryBadgeVariant,
	getScopeBadgeVariant,
} from "./utils.ts";
