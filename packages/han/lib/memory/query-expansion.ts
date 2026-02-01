/**
 * Query Expansion for Han Memory
 *
 * Bridges semantic gaps by expanding queries with synonyms and acronyms.
 * Uses FTS5 OR syntax: term1 OR term2 OR "phrase term"
 *
 * Example:
 *   Input: "vcs strategy"
 *   Output: ("vcs" OR "version control" OR "git") "strategy"
 */

/**
 * FTS5 reserved operators that could cause injection if present in expansions.
 * These MUST NOT appear unquoted in expansion terms.
 */
const FTS5_RESERVED = ["AND", "OR", "NOT", "NEAR", "MATCH"];

/**
 * Validate that expansion terms don't contain FTS5 operators.
 * Throws at load time if invalid terms are detected.
 */
function validateExpansionTerms(
	terms: Record<string, string[]>,
	mapName: string,
): void {
	for (const [key, values] of Object.entries(terms)) {
		for (const value of values) {
			const upperValue = value.toUpperCase();
			for (const reserved of FTS5_RESERVED) {
				// Check if reserved word appears as a standalone word
				const pattern = new RegExp(`\\b${reserved}\\b`, "i");
				if (pattern.test(upperValue)) {
					throw new Error(
						`Invalid expansion: ${mapName}["${key}"] contains FTS5 operator "${reserved}" in value "${value}"`,
					);
				}
			}
		}
	}
}

/** Expansion level configuration */
export type ExpansionLevel = "none" | "minimal" | "full";

/** Expansion options */
export interface ExpandQueryOptions {
	/** Expansion level: none (exact match), minimal (acronyms only), full (acronyms + synonyms) */
	level?: ExpansionLevel;
	/** Maximum terms to include per word (default: 5) */
	maxTerms?: number;
}

/** Result of query expansion */
export interface ExpandedQuery {
	/** Original query string */
	original: string;
	/** FTS5-ready expanded query string */
	expanded: string;
	/** All terms included in the expansion */
	terms: string[];
	/** Number of words that had expansions applied */
	expansionsApplied: number;
}

/**
 * Acronym expansions - each acronym maps to its full form and related terms
 *
 * Focused on development/programming domain terminology.
 */
export const ACRONYMS: Record<string, string[]> = {
	// Version Control
	vcs: ["version control", "version control system", "git", "source control"],
	scm: ["source control", "source code management", "git"],
	pr: ["pull request", "merge request"],
	mr: ["merge request", "pull request"],

	// CI/CD
	ci: ["continuous integration", "build pipeline"],
	cd: ["continuous deployment", "continuous delivery"],
	cicd: ["continuous integration", "continuous deployment", "pipeline"],

	// Authentication
	auth: ["authentication", "authorization", "login"],
	oauth: ["open authorization", "authentication"],
	jwt: ["json web token", "token", "authentication"],
	sso: ["single sign on", "authentication"],
	mfa: ["multi factor authentication", "2fa", "two factor"],
	"2fa": ["two factor authentication", "mfa"],

	// APIs
	api: ["application programming interface", "endpoint", "rest"],
	rest: ["representational state transfer", "api", "http"],
	grpc: ["remote procedure call", "rpc", "protobuf"],
	rpc: ["remote procedure call", "grpc"],
	sdk: ["software development kit", "library", "client"],

	// Databases
	db: ["database"],
	sql: ["structured query language", "database", "query"],
	orm: ["object relational mapping", "database"],
	fts: ["full text search", "search", "index"],

	// Testing
	tdd: ["test driven development", "testing"],
	bdd: ["behavior driven development", "testing", "cucumber"],
	e2e: ["end to end", "integration test", "playwright"],
	qa: ["quality assurance", "testing"],

	// Development Process
	mvp: ["minimum viable product", "prototype"],
	prd: ["product requirements document", "requirements", "spec"],
	rfc: ["request for comments", "proposal", "design doc"],
	poc: ["proof of concept", "prototype"],

	// Infrastructure
	k8s: ["kubernetes", "container", "orchestration"],
	aws: ["amazon web services", "cloud"],
	gcp: ["google cloud platform", "cloud"],
	vm: ["virtual machine", "server"],
	cdn: ["content delivery network", "cache"],

	// Code Quality
	lsp: ["language server protocol", "editor", "intellisense"],
	ide: ["integrated development environment", "editor"],
	lint: ["linting", "code style", "eslint", "biome"],

	// Security
	xss: ["cross site scripting", "injection", "security"],
	csrf: ["cross site request forgery", "security"],
	cors: ["cross origin resource sharing", "security", "http"],

	// MCP / AI
	mcp: ["model context protocol", "claude", "tool"],
	llm: ["large language model", "ai", "model"],
	rag: ["retrieval augmented generation", "context", "search"],
};

/**
 * Synonym expansions - bidirectional related terms
 *
 * Applied only in "full" expansion mode for broader semantic matching.
 */
export const SYNONYMS: Record<string, string[]> = {
	// Version Control Concepts
	branch: ["branching", "feature branch", "branch strategy"],
	merge: ["merging", "pull request", "integration"],
	commit: ["commits", "changeset", "revision"],
	rebase: ["rebasing", "history rewrite"],
	worktree: ["working tree", "checkout"],

	// Code Actions
	refactor: ["refactoring", "restructure", "reorganize"],
	debug: ["debugging", "troubleshoot", "fix"],
	deploy: ["deployment", "release", "ship"],
	build: ["building", "compile", "bundle"],
	test: ["testing", "tests", "spec"],

	// Code Structure
	function: ["method", "procedure", "subroutine"],
	class: ["type", "struct", "object"],
	module: ["package", "library", "component"],
	interface: ["contract", "protocol", "type"],

	// Project Elements
	config: ["configuration", "settings", "options"],
	error: ["exception", "failure", "bug"],
	log: ["logging", "logs", "trace"],
	cache: ["caching", "memoize", "store"],

	// Common Dev Terms
	async: ["asynchronous", "concurrent", "parallel"],
	sync: ["synchronous", "blocking"],
	hook: ["hooks", "lifecycle", "callback"],
	plugin: ["plugins", "extension", "addon"],

	// File Types (also handle reverse lookups)
	typescript: ["ts", "tsx"],
	javascript: ["js", "jsx", "ecmascript"],
	python: ["py"],
	rust: ["rs"],

	// Common abbreviations that aren't strict acronyms
	repo: ["repository", "git repo"],
	env: ["environment", "environment variable"],
	dep: ["dependency", "dependencies"],
	deps: ["dependencies", "packages"],
	pkg: ["package", "packages"],
	dir: ["directory", "folder"],
	src: ["source", "source code"],
	lib: ["library", "libraries"],
	util: ["utility", "utilities", "helper"],
	utils: ["utilities", "helpers"],
};

// Validate expansion maps at module load time to catch FTS5 injection risks early
validateExpansionTerms(ACRONYMS, "ACRONYMS");
validateExpansionTerms(SYNONYMS, "SYNONYMS");

/**
 * Expand a query with synonyms and acronyms
 *
 * @param query - Original user query
 * @param options - Expansion options
 * @returns Expanded query ready for FTS5
 *
 * @example
 * ```typescript
 * // Minimal expansion (acronyms only)
 * expandQuery("vcs strategy", { level: "minimal" })
 * // => { expanded: '("vcs" OR "version control" OR "git") "strategy"', ... }
 *
 * // Full expansion (acronyms + synonyms)
 * expandQuery("refactor", { level: "full" })
 * // => { expanded: '("refactor" OR "refactoring" OR "restructure")', ... }
 *
 * // No expansion
 * expandQuery("exact term", { level: "none" })
 * // => { expanded: '"exact" "term"', ... }
 * ```
 */
export function expandQuery(
	query: string,
	options: ExpandQueryOptions = {},
): ExpandedQuery {
	const { level = "minimal", maxTerms = 5 } = options;

	// Handle empty query
	if (!query.trim()) {
		return {
			original: query,
			expanded: "",
			terms: [],
			expansionsApplied: 0,
		};
	}

	// No expansion - just escape for FTS5
	if (level === "none") {
		const terms = query.split(/\s+/).filter(Boolean);
		return {
			original: query,
			expanded: escapeForFts(query),
			terms,
			expansionsApplied: 0,
		};
	}

	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	const allTermGroups: string[][] = [];
	let expansionsApplied = 0;

	for (const word of words) {
		const termGroup = [word];
		let wasExpanded = false;

		// Check acronyms first (higher priority, applied in both minimal and full)
		const acronymExpansions = ACRONYMS[word];
		if (acronymExpansions) {
			const toAdd = acronymExpansions.slice(0, maxTerms - 1);
			termGroup.push(...toAdd);
			wasExpanded = true;
		}

		// Check synonyms if level is "full"
		if (level === "full") {
			const synonymExpansions = SYNONYMS[word];
			if (synonymExpansions) {
				const remaining = maxTerms - termGroup.length;
				if (remaining > 0) {
					termGroup.push(...synonymExpansions.slice(0, remaining));
					wasExpanded = true;
				}
			}
		}

		if (wasExpanded) {
			expansionsApplied++;
		}

		// Deduplicate terms in the group
		allTermGroups.push([...new Set(termGroup)]);
	}

	// Build FTS5 query with OR logic
	const expanded = buildFtsQuery(allTermGroups);

	return {
		original: query,
		expanded,
		terms: allTermGroups.flat(),
		expansionsApplied,
	};
}

/**
 * Build FTS5-compatible query string with OR logic
 *
 * For input [["vcs", "version control", "git"], ["strategy"]]
 * Produces: ("vcs" OR "version control" OR "git") "strategy"
 */
function buildFtsQuery(termGroups: string[][]): string {
	return termGroups
		.map((group) => {
			if (group.length === 1) {
				return escapeTermForFts(group[0]);
			}
			// Multiple terms: wrap in parentheses with OR
			const terms = group.map((t) => escapeTermForFts(t));
			return `(${terms.join(" OR ")})`;
		})
		.join(" ");
}

/**
 * Escape a single term for FTS5
 *
 * Handles phrases (multi-word) and special characters.
 * Always quotes terms to prevent FTS5 operator interpretation.
 */
function escapeTermForFts(term: string): string {
	// Escape internal quotes by doubling them
	const escaped = term.replace(/"/g, '""');
	return `"${escaped}"`;
}

/**
 * Simple escape for non-expanded queries (legacy behavior)
 *
 * Quotes each word to prevent FTS5 operator interpretation.
 */
function escapeForFts(query: string): string {
	return query.split(/\s+/).filter(Boolean).map(escapeTermForFts).join(" ");
}

/**
 * Check if a term has available expansions
 *
 * Useful for UI hints or debugging.
 */
export function hasExpansion(
	term: string,
	level: ExpansionLevel = "minimal",
): boolean {
	const lowerTerm = term.toLowerCase();
	if (ACRONYMS[lowerTerm]) return true;
	if (level === "full" && SYNONYMS[lowerTerm]) return true;
	return false;
}

/**
 * Get all expansions for a single term
 *
 * Useful for UI preview or debugging.
 */
export function getExpansions(
	term: string,
	level: ExpansionLevel = "minimal",
): string[] {
	const lowerTerm = term.toLowerCase();
	const expansions: string[] = [];

	if (ACRONYMS[lowerTerm]) {
		expansions.push(...ACRONYMS[lowerTerm]);
	}

	if (level === "full" && SYNONYMS[lowerTerm]) {
		expansions.push(...SYNONYMS[lowerTerm]);
	}

	return [...new Set(expansions)];
}
