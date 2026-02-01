/**
 * Memory Layer Info Type
 *
 * Information about available memory layers for a user.
 */

import { builder } from "../../builder.ts";

/**
 * Memory layer info data interface
 */
export interface MemoryLayerInfoData {
	name: string;
	description: string;
	available: boolean;
	sessionCount: number;
}

/**
 * Memory layer info object reference
 */
const MemoryLayerInfoRef =
	builder.objectRef<MemoryLayerInfoData>("MemoryLayerInfo");

/**
 * Memory layer info type implementation
 */
export const MemoryLayerInfoType = MemoryLayerInfoRef.implement({
	description: "Information about a memory layer available to the user",
	fields: (t) => ({
		name: t.exposeString("name", {
			description: "Layer name (personal, project, team, org)",
		}),
		description: t.exposeString("description", {
			description: "Human-readable description",
		}),
		available: t.exposeBoolean("available", {
			description: "Whether this layer is available to the user",
		}),
		sessionCount: t.exposeInt("sessionCount", {
			description: "Number of sessions accessible in this layer",
		}),
	}),
});
