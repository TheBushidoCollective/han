/**
 * @generated SignedSource<<4912d3bbe02c47cc79662869b4ff63f9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type RuleScope = "PROJECT" | "USER" | "%future added value";
export type RulesTabQuery$variables = Record<PropertyKey, never>;
export type RulesTabQuery$data = {
	readonly memory:
		| {
				readonly rules:
					| ReadonlyArray<{
							readonly content: string | null | undefined;
							readonly domain: string | null | undefined;
							readonly id: string | null | undefined;
							readonly path: string | null | undefined;
							readonly scope: RuleScope | null | undefined;
							readonly size: number | null | undefined;
					  }>
					| null
					| undefined;
		  }
		| null
		| undefined;
};
export type RulesTabQuery = {
	response: RulesTabQuery$data;
	variables: RulesTabQuery$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = [
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
					args: null,
					concreteType: "Rule",
					kind: "LinkedField",
					name: "rules",
					plural: true,
					selections: [
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "id",
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "domain",
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "scope",
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "path",
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
							name: "size",
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
			argumentDefinitions: [],
			kind: "Fragment",
			metadata: null,
			name: "RulesTabQuery",
			selections: v0 /*: any*/,
			type: "Query",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: [],
			kind: "Operation",
			name: "RulesTabQuery",
			selections: v0 /*: any*/,
		},
		params: {
			cacheID: "d34c207f6cea3e1d71a7594b1257b719",
			id: null,
			metadata: {},
			name: "RulesTabQuery",
			operationKind: "query",
			text: "query RulesTabQuery {\n  memory {\n    rules {\n      id\n      domain\n      scope\n      path\n      content\n      size\n    }\n  }\n}\n",
		},
	};
})();

(node as any).hash = "9df4b8c40e4c9d122ea54ad10d89bbd1";

export default node;
