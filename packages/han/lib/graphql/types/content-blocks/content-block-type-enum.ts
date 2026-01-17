/**
 * GraphQL ContentBlockType enum
 *
 * Type of content block in a message.
 */

import { builder } from "../../builder.ts";

export const ContentBlockTypeEnum = builder.enumType("ContentBlockType", {
	values: ["THINKING", "TEXT", "TOOL_USE", "TOOL_RESULT", "IMAGE"] as const,
	description: "Type of content block in a message",
});
