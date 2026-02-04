/**
 * @generated SignedSource<<972ba24fac96037f3a49576b1f6a377d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type RepoListPageQuery$variables = Record<PropertyKey, never>;
export type RepoListPageQuery$data = {
	readonly repos:
		| ReadonlyArray<{
				readonly id: string;
				readonly lastActivity: any | null | undefined;
				readonly name: string | null | undefined;
				readonly path: string | null | undefined;
				readonly repoId: string | null | undefined;
				readonly totalSessions: number | null | undefined;
		  }>
		| null
		| undefined;
};
export type RepoListPageQuery = {
	response: RepoListPageQuery$data;
	variables: RepoListPageQuery$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = [
		{
			alias: null,
			args: [
				{
					kind: "Literal",
					name: "first",
					value: 100,
				},
			],
			concreteType: "Repo",
			kind: "LinkedField",
			name: "repos",
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
					name: "repoId",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "name",
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
					name: "totalSessions",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "lastActivity",
					storageKey: null,
				},
			],
			storageKey: "repos(first:100)",
		},
	];
	return {
		fragment: {
			argumentDefinitions: [],
			kind: "Fragment",
			metadata: null,
			name: "RepoListPageQuery",
			selections: v0 /*: any*/,
			type: "Query",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: [],
			kind: "Operation",
			name: "RepoListPageQuery",
			selections: v0 /*: any*/,
		},
		params: {
			cacheID: "ae4cef4e0fd745b7ee55fe38236c8398",
			id: null,
			metadata: {},
			name: "RepoListPageQuery",
			operationKind: "query",
			text: "query RepoListPageQuery {\n  repos(first: 100) {\n    id\n    repoId\n    name\n    path\n    totalSessions\n    lastActivity\n  }\n}\n",
		},
	};
})();

(node as any).hash = "4e0dc47129eaf3a3d8aaf41ecbd6c4ce";

export default node;
