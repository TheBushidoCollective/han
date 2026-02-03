/**
 * Memory Page Types
 *
 * Shared interfaces for memory page components.
 */

export interface Citation {
	source: string;
	excerpt: string;
	author: string | null;
	timestamp: string | null;
	layer: string | null;
}

export interface SearchResult {
	answer: string;
	source: string;
	confidence: string;
	caveats: string[];
	layersSearched: string[];
	citations: Citation[];
}

export interface Rule {
	id: string;
	domain: string;
	scope: string;
	path: string;
	content: string;
	size: number;
}

export interface SearchData {
	viewer: {
		memory: {
			search: SearchResult;
		};
	};
}

export interface RulesData {
	viewer: {
		memory: {
			rules: Rule[];
		};
	};
}

export type Tab = "search" | "rules";
