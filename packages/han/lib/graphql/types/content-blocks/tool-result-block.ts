/**
 * GraphQL ToolResultBlock type
 *
 * Result returned from a tool execution.
 */

import { builder } from "../../builder.ts";
import type {
	ContentBlockData,
	ToolResultBlockData,
} from "./content-block-data.ts";
import { ContentBlockInterface } from "./content-block-interface.ts";
import { ContentBlockTypeEnum } from "./content-block-type-enum.ts";

export const ToolResultBlockType = builder
	.objectRef<ToolResultBlockData>("ToolResultBlock")
	.implement({
		description: "Result returned from a tool execution",
		interfaces: [ContentBlockInterface],
		isTypeOf: (obj): obj is ToolResultBlockData =>
			(obj as ContentBlockData).type === "TOOL_RESULT",
		fields: (t) => ({
			type: t.field({
				type: ContentBlockTypeEnum,
				resolve: () => "TOOL_RESULT" as const,
			}),
			toolCallId: t.exposeString("toolCallId", {
				description: "ID of the tool call this is a result for",
			}),
			content: t.exposeString("content", {
				description: "Full result content",
			}),
			isError: t.exposeBoolean("isError", {
				description: "Whether this result is an error",
			}),
			isLong: t.exposeBoolean("isLong", {
				description: "Whether content exceeds preview length",
			}),
			preview: t.exposeString("preview", {
				description: "Preview of content (first 500 chars)",
			}),
			hasImage: t.exposeBoolean("hasImage", {
				description: "Whether this result contains an image",
			}),
		}),
	});
