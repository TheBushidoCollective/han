/**
 * @generated SignedSource<<457f49fab718fb2c0b959ab22f11c0b6>>
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
export type SearchTabResultSubscription$variables = {
	sessionId: string;
};
export type SearchTabResultSubscription$data = {
	readonly memoryAgentResult:
		| {
				readonly answer: string | null | undefined;
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
				readonly error: string | null | undefined;
				readonly searchedLayers: ReadonlyArray<MemoryLayer> | null | undefined;
				readonly sessionId: string | null | undefined;
				readonly success: boolean | null | undefined;
		  }
		| null
		| undefined;
};
export type SearchTabResultSubscription = {
	response: SearchTabResultSubscription$data;
	variables: SearchTabResultSubscription$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = [
			{
				defaultValue: null,
				kind: "LocalArgument",
				name: "sessionId",
			},
		],
		v1 = [
			{
				alias: null,
				args: [
					{
						kind: "Variable",
						name: "sessionId",
						variableName: "sessionId",
					},
				],
				concreteType: "MemoryAgentResult",
				kind: "LinkedField",
				name: "memoryAgentResult",
				plural: false,
				selections: [
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "sessionId",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "answer",
						storageKey: null,
					},
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
						concreteType: "Citation",
						kind: "LinkedField",
						name: "citations",
						plural: true,
						selections: [
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "source",
								storageKey: null,
							},
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
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "searchedLayers",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "success",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "error",
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
			name: "SearchTabResultSubscription",
			selections: v1 /*: any*/,
			type: "Subscription",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Operation",
			name: "SearchTabResultSubscription",
			selections: v1 /*: any*/,
		},
		params: {
			cacheID: "94a51b61fca07ff23028a74b3ce64562",
			id: null,
			metadata: {},
			name: "SearchTabResultSubscription",
			operationKind: "subscription",
			text: "subscription SearchTabResultSubscription(\n  $sessionId: String!\n) {\n  memoryAgentResult(sessionId: $sessionId) {\n    sessionId\n    answer\n    confidence\n    citations {\n      source\n      excerpt\n      author\n      timestamp\n      layer\n      projectName\n      projectPath\n    }\n    searchedLayers\n    success\n    error\n  }\n}\n",
		},
	};
})();

(node as any).hash = "051b76537a2b51453959bed4952374c7";

export default node;
