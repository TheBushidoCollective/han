/**
 * @generated SignedSource<<ee20970f5cccf5c60e35149d5ec3b224>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type Confidence = "HIGH" | "LOW" | "MEDIUM" | "%future added value";
export type MemoryLayer =
	| "OBSERVATIONS"
	| "RULES"
	| "SUMMARIES"
	| "TEAM"
	| "TRANSCRIPTS"
	| "%future added value";
export type MemorySource =
	| "COMBINED"
	| "PERSONAL"
	| "RULES"
	| "TEAM"
	| "TRANSCRIPTS"
	| "%future added value";
export type SearchTabQuery$variables = {
	query: string;
};
export type SearchTabQuery$data = {
	readonly memory:
		| {
				readonly search:
					| {
							readonly answer: string | null | undefined;
							readonly caveats: ReadonlyArray<string> | null | undefined;
							readonly citations:
								| ReadonlyArray<{
										readonly author: string | null | undefined;
										readonly excerpt: string | null | undefined;
										readonly layer: MemoryLayer | null | undefined;
										readonly projectName: string | null | undefined;
										readonly projectPath: string | null | undefined;
										readonly source: string | null | undefined;
										readonly timestamp: any | null | undefined;
								  }>
								| null
								| undefined;
							readonly confidence: Confidence | null | undefined;
							readonly layersSearched:
								| ReadonlyArray<MemoryLayer>
								| null
								| undefined;
							readonly source: MemorySource | null | undefined;
					  }
					| null
					| undefined;
		  }
		| null
		| undefined;
};
export type SearchTabQuery = {
	response: SearchTabQuery$data;
	variables: SearchTabQuery$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = [
			{
				defaultValue: null,
				kind: "LocalArgument",
				name: "query",
			},
		],
		v1 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "source",
			storageKey: null,
		},
		v2 = [
			{
				alias: null,
				args: null,
				concreteType: "MemoryQuery",
				kind: "LinkedField",
				name: "memory",
				plural: false,
				selections: [
					{
						alias: null,
						args: [
							{
								kind: "Variable",
								name: "query",
								variableName: "query",
							},
						],
						concreteType: "MemorySearchResult",
						kind: "LinkedField",
						name: "search",
						plural: false,
						selections: [
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "answer",
								storageKey: null,
							},
							v1 /*: any*/,
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "confidence",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "caveats",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "layersSearched",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								concreteType: "Citation",
								kind: "LinkedField",
								name: "citations",
								plural: true,
								selections: [
									v1 /*: any*/,
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "excerpt",
										storageKey: null,
									},
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "author",
										storageKey: null,
									},
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "timestamp",
										storageKey: null,
									},
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "layer",
										storageKey: null,
									},
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "projectName",
										storageKey: null,
									},
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "projectPath",
										storageKey: null,
									},
								],
								storageKey: null,
							},
						],
						storageKey: null,
					},
				],
				storageKey: null,
			},
		];
	return {
		fragment: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Fragment",
			metadata: null,
			name: "SearchTabQuery",
			selections: v2 /*: any*/,
			type: "Query",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Operation",
			name: "SearchTabQuery",
			selections: v2 /*: any*/,
		},
		params: {
			cacheID: "5c174eed5be1f2b2a219846e1fcde942",
			id: null,
			metadata: {},
			name: "SearchTabQuery",
			operationKind: "query",
			text: "query SearchTabQuery(\n  $query: String!\n) {\n  memory {\n    search(query: $query) {\n      answer\n      source\n      confidence\n      caveats\n      layersSearched\n      citations {\n        source\n        excerpt\n        author\n        timestamp\n        layer\n        projectName\n        projectPath\n      }\n    }\n  }\n}\n",
		},
	};
})();

(node as any).hash = "64c3791ab963c6650bfd66abbbf81bee";

export default node;
