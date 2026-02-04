/**
 * @generated SignedSource<<bd05c0a342571b4ff158f90115fe3906>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type SessionMessagesSearchQuery$variables = {
	query: string;
	sessionId: string;
};
export type SessionMessagesSearchQuery$data = {
	readonly node:
		| {
				readonly searchMessages?:
					| ReadonlyArray<{
							readonly matchContext: string | null | undefined;
							readonly messageId: string | null | undefined;
							readonly messageIndex: number | null | undefined;
							readonly preview: string | null | undefined;
					  }>
					| null
					| undefined;
		  }
		| null
		| undefined;
};
export type SessionMessagesSearchQuery = {
	response: SessionMessagesSearchQuery$data;
	variables: SessionMessagesSearchQuery$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = {
			defaultValue: null,
			kind: "LocalArgument",
			name: "query",
		},
		v1 = {
			defaultValue: null,
			kind: "LocalArgument",
			name: "sessionId",
		},
		v2 = [
			{
				kind: "Variable",
				name: "id",
				variableName: "sessionId",
			},
		],
		v3 = {
			kind: "InlineFragment",
			selections: [
				{
					alias: null,
					args: [
						{
							kind: "Literal",
							name: "limit",
							value: 20,
						},
						{
							kind: "Variable",
							name: "query",
							variableName: "query",
						},
					],
					concreteType: "MessageSearchResult",
					kind: "LinkedField",
					name: "searchMessages",
					plural: true,
					selections: [
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "messageId",
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "messageIndex",
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "preview",
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "matchContext",
							storageKey: null,
						},
					],
					storageKey: null,
				},
			],
			type: "Session",
			abstractKey: null,
		};
	return {
		fragment: {
			argumentDefinitions: [v0 /*: any*/, v1 /*: any*/],
			kind: "Fragment",
			metadata: null,
			name: "SessionMessagesSearchQuery",
			selections: [
				{
					alias: null,
					args: v2 /*: any*/,
					concreteType: null,
					kind: "LinkedField",
					name: "node",
					plural: false,
					selections: [v3 /*: any*/],
					storageKey: null,
				},
			],
			type: "Query",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: [v1 /*: any*/, v0 /*: any*/],
			kind: "Operation",
			name: "SessionMessagesSearchQuery",
			selections: [
				{
					alias: null,
					args: v2 /*: any*/,
					concreteType: null,
					kind: "LinkedField",
					name: "node",
					plural: false,
					selections: [
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "__typename",
							storageKey: null,
						},
						v3 /*: any*/,
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "id",
							storageKey: null,
						},
					],
					storageKey: null,
				},
			],
		},
		params: {
			cacheID: "2b2e5fd3479bf7f1acf06c542109f7b1",
			id: null,
			metadata: {},
			name: "SessionMessagesSearchQuery",
			operationKind: "query",
			text: "query SessionMessagesSearchQuery(\n  $sessionId: ID!\n  $query: String!\n) {\n  node(id: $sessionId) {\n    __typename\n    ... on Session {\n      searchMessages(query: $query, limit: 20) {\n        messageId\n        messageIndex\n        preview\n        matchContext\n      }\n    }\n    id\n  }\n}\n",
		},
	};
})();

(node as any).hash = "1d45bcf191f7fb41b56d31f6b5f0cc38";

export default node;
