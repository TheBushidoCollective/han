/**
 * GraphQL Citation type
 *
 * Citation from memory search.
 */

import { builder } from "../../builder.ts";
import { MemoryLayerEnum } from "./memory-layer-enum.ts";

/**
 * Citation interface
 */
export interface Citation {
	source: string;
	excerpt: string;
	author?: string;
	timestamp?: number;
	layer?: string;
	projectPath?: string;
	projectName?: string;
}

const CitationRef = builder.objectRef<Citation>("Citation");

export const CitationType = CitationRef.implement({
	description: "Citation from memory search",
	fields: (t) => ({
		source: t.exposeString("source", { description: "Source identifier" }),
		excerpt: t.exposeString("excerpt", { description: "Relevant excerpt" }),
		author: t.string({
			nullable: true,
			description: "Author if known",
			resolve: (c) => c.author ?? null,
		}),
		timestamp: t.field({
			type: "DateTime",
			nullable: true,
			description: "Timestamp if known",
			resolve: (c) => c.timestamp ?? null,
		}),
		layer: t.field({
			type: MemoryLayerEnum,
			nullable: true,
			description: "Memory layer this came from",
			resolve: (c) => {
				if (!c.layer) return null;
				return c.layer.toUpperCase() as
					| "RULES"
					| "SUMMARIES"
					| "OBSERVATIONS"
					| "TRANSCRIPTS"
					| "TEAM";
			},
		}),
		projectPath: t.string({
			nullable: true,
			description: "Full filesystem path to the project",
			resolve: (c) => c.projectPath ?? null,
		}),
		projectName: t.string({
			nullable: true,
			description: "Human-readable project name (e.g., han, website)",
			resolve: (c) => c.projectName ?? null,
		}),
	}),
});
