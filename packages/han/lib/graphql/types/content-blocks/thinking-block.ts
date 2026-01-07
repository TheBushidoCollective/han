/**
 * GraphQL ThinkingBlock type
 *
 * Claude's thinking/reasoning block (extended thinking).
 */

import { builder } from "../../builder.ts";
import type {
	ContentBlockData,
	ThinkingBlockData,
} from "./content-block-data.ts";
import { ContentBlockInterface } from "./content-block-interface.ts";
import { ContentBlockTypeEnum } from "./content-block-type-enum.ts";

export const ThinkingBlockType = builder
	.objectRef<ThinkingBlockData>("ThinkingBlock")
	.implement({
		description: "Claude's thinking/reasoning block (extended thinking)",
		interfaces: [ContentBlockInterface],
		isTypeOf: (obj): obj is ThinkingBlockData =>
			(obj as ContentBlockData).type === "THINKING",
		fields: (t) => ({
			type: t.field({
				type: ContentBlockTypeEnum,
				resolve: () => "THINKING" as const,
			}),
			thinking: t.exposeString("thinking", {
				description: "Full thinking content",
			}),
			preview: t.exposeString("preview", {
				description: "First ~200 chars for collapsed view",
			}),
			signature: t.string({
				nullable: true,
				description: "Cryptographic signature if present",
				resolve: (block) => block.signature ?? null,
			}),
		}),
	});
