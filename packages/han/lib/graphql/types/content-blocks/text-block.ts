/**
 * GraphQL TextBlock type
 *
 * Regular text content.
 */

import { builder } from "../../builder.ts";
import type { ContentBlockData, TextBlockData } from "./content-block-data.ts";
import { ContentBlockInterface } from "./content-block-interface.ts";
import { ContentBlockTypeEnum } from "./content-block-type-enum.ts";

export const TextBlockType = builder
	.objectRef<TextBlockData>("TextBlock")
	.implement({
		description: "Regular text content",
		interfaces: [ContentBlockInterface],
		isTypeOf: (obj): obj is TextBlockData =>
			(obj as ContentBlockData).type === "TEXT",
		fields: (t) => ({
			type: t.field({
				type: ContentBlockTypeEnum,
				resolve: () => "TEXT" as const,
			}),
			text: t.exposeString("text", {
				description: "The text content",
			}),
		}),
	});
