/**
 * GraphQL ToolCategory enum
 *
 * Category of tool.
 */

import { builder } from "../../builder.ts";

export const ToolCategoryEnum = builder.enumType("ToolCategory", {
	values: ["FILE", "SEARCH", "SHELL", "WEB", "TASK", "MCP", "OTHER"] as const,
	description: "Category of tool",
});
