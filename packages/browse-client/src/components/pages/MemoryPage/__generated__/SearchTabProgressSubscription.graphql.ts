/**
 * @generated SignedSource<<c9ebc873bcf6bee99672e3dbe722ef5b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type MemoryAgentProgressType =
	| "COMPLETE"
	| "ERROR"
	| "FOUND"
	| "SEARCHING"
	| "SYNTHESIZING"
	| "%future added value";
export type SearchTabProgressSubscription$variables = {
	sessionId: string;
};
export type SearchTabProgressSubscription$data = {
	readonly memoryAgentProgress:
		| {
				readonly content: string | null | undefined;
				readonly layer: string | null | undefined;
				readonly resultCount: number | null | undefined;
				readonly sessionId: string | null | undefined;
				readonly timestamp: any | null | undefined;
				readonly type: MemoryAgentProgressType | null | undefined;
		  }
		| null
		| undefined;
};
export type SearchTabProgressSubscription = {
	response: SearchTabProgressSubscription$data;
	variables: SearchTabProgressSubscription$variables;
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
				concreteType: "MemoryAgentProgress",
				kind: "LinkedField",
				name: "memoryAgentProgress",
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
						name: "type",
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
						name: "content",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "resultCount",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "timestamp",
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
			name: "SearchTabProgressSubscription",
			selections: v1 /*: any*/,
			type: "Subscription",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Operation",
			name: "SearchTabProgressSubscription",
			selections: v1 /*: any*/,
		},
		params: {
			cacheID: "ec7502bd2793e76832587fc680c52fa8",
			id: null,
			metadata: {},
			name: "SearchTabProgressSubscription",
			operationKind: "subscription",
			text: "subscription SearchTabProgressSubscription(\n  $sessionId: String!\n) {\n  memoryAgentProgress(sessionId: $sessionId) {\n    sessionId\n    type\n    layer\n    content\n    resultCount\n    timestamp\n  }\n}\n",
		},
	};
})();

(node as any).hash = "eed71832d333bc777978bacc8e4877ac";

export default node;
