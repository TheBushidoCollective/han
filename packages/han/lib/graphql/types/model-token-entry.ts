/**
 * GraphQL ModelTokenEntry type
 *
 * Token usage for a specific model.
 */

import { builder } from "../builder.ts";

/**
 * Token entry for a specific model on a given day
 */
export interface ModelTokenEntry {
	model: string;
	displayName: string;
	tokens: number;
}

/**
 * Model token entry type ref
 */
const ModelTokenEntryRef =
	builder.objectRef<ModelTokenEntry>("ModelTokenEntry");

/**
 * Model token entry type implementation
 */
export const ModelTokenEntryType = ModelTokenEntryRef.implement({
	description: "Token usage for a specific model",
	fields: (t) => ({
		model: t.exposeString("model", {
			description: "Model ID (e.g., claude-opus-4-5-20251101)",
		}),
		displayName: t.exposeString("displayName", {
			description: "Human-readable model name (e.g., Opus 4.5)",
		}),
		tokens: t.field({
			type: "BigInt",
			description: "Token count for this model",
			resolve: (data) => data.tokens,
		}),
	}),
});
