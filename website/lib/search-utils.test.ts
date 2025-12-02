import { deepStrictEqual, strictEqual } from "node:assert";
import { hasComponent, parseQuery } from "./search-utils.js";

function test(name: string, fn: () => void): void {
	try {
		fn();
		console.log(`✓ ${name}`);
	} catch (error) {
		console.error(`✗ ${name}`);
		console.error((error as Error).message);
		process.exit(1);
	}
}

// ============================================
// parseQuery tests
// ============================================

test("parseQuery parses plain text query", () => {
	const result = parseQuery("typescript react");
	strictEqual(result.textQuery, "typescript react");
	deepStrictEqual(result.tagFilters, []);
	deepStrictEqual(result.componentFilters, []);
	deepStrictEqual(result.categoryFilters, []);
});

test("parseQuery extracts single tag filter", () => {
	const result = parseQuery("tag:typescript");
	strictEqual(result.textQuery, "");
	deepStrictEqual(result.tagFilters, ["typescript"]);
});

test("parseQuery extracts multiple tags with comma", () => {
	const result = parseQuery("tags:typescript,react,testing");
	strictEqual(result.textQuery, "");
	deepStrictEqual(result.tagFilters, ["typescript", "react", "testing"]);
});

test("parseQuery extracts component filter", () => {
	const result = parseQuery("component:skill");
	strictEqual(result.textQuery, "");
	deepStrictEqual(result.componentFilters, ["skill"]);
});

test("parseQuery extracts multiple components", () => {
	const result = parseQuery("components:skill,agent,command");
	strictEqual(result.textQuery, "");
	deepStrictEqual(result.componentFilters, ["skill", "agent", "command"]);
});

test("parseQuery extracts category filter", () => {
	const result = parseQuery("category:jutsu");
	strictEqual(result.textQuery, "");
	deepStrictEqual(result.categoryFilters, ["jutsu"]);
});

test("parseQuery extracts multiple categories", () => {
	const result = parseQuery("categories:jutsu,do,hashi");
	strictEqual(result.textQuery, "");
	deepStrictEqual(result.categoryFilters, ["jutsu", "do", "hashi"]);
});

test("parseQuery handles mixed query with text and filters", () => {
	const result = parseQuery(
		"typescript tag:react component:skill category:jutsu",
	);
	strictEqual(result.textQuery, "typescript");
	deepStrictEqual(result.tagFilters, ["react"]);
	deepStrictEqual(result.componentFilters, ["skill"]);
	deepStrictEqual(result.categoryFilters, ["jutsu"]);
});

test("parseQuery handles complex mixed query", () => {
	const result = parseQuery(
		"linting tags:eslint,biome category:jutsu formatting",
	);
	strictEqual(result.textQuery, "linting formatting");
	deepStrictEqual(result.tagFilters, ["eslint", "biome"]);
	deepStrictEqual(result.categoryFilters, ["jutsu"]);
});

test("parseQuery is case-insensitive for filter prefixes", () => {
	const result = parseQuery("TAG:typescript COMPONENT:skill CATEGORY:jutsu");
	deepStrictEqual(result.tagFilters, ["typescript"]);
	deepStrictEqual(result.componentFilters, ["skill"]);
	deepStrictEqual(result.categoryFilters, ["jutsu"]);
});

test("parseQuery handles empty query", () => {
	const result = parseQuery("");
	strictEqual(result.textQuery, "");
	deepStrictEqual(result.tagFilters, []);
	deepStrictEqual(result.componentFilters, []);
	deepStrictEqual(result.categoryFilters, []);
});

test("parseQuery handles whitespace-only query", () => {
	const result = parseQuery("   ");
	strictEqual(result.textQuery, "");
	deepStrictEqual(result.tagFilters, []);
});

test("parseQuery handles multiple spaces between terms", () => {
	const result = parseQuery("react    typescript    tag:biome");
	strictEqual(result.textQuery, "react typescript");
	deepStrictEqual(result.tagFilters, ["biome"]);
});

// ============================================
// hasComponent tests
// ============================================

test("hasComponent returns true when component exists", () => {
	const components = ["skill", "agent", "command"];
	strictEqual(hasComponent(components, "skill"), true);
});

test("hasComponent returns false when component doesn't exist", () => {
	const components = ["skill", "agent"];
	strictEqual(hasComponent(components, "hook"), false);
});

test("hasComponent is case-insensitive", () => {
	const components = ["Skill", "Agent"];
	strictEqual(hasComponent(components, "skill"), true);
	strictEqual(hasComponent(components, "AGENT"), true);
});

test("hasComponent handles empty components array", () => {
	const components: string[] = [];
	strictEqual(hasComponent(components, "skill"), false);
});

console.log("\nAll search-utils tests passed! ✓");
