/**
 * @generated SignedSource<<f063493f4f4f98b1578c11b2479aa66c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type RepoDetailPageQuery$variables = {
	id: string;
};
export type RepoDetailPageQuery$data = {
	readonly repo:
		| {
				readonly id: string;
				readonly lastActivity: any | null | undefined;
				readonly name: string | null | undefined;
				readonly path: string | null | undefined;
				readonly projects:
					| ReadonlyArray<{
							readonly id: string | null | undefined;
							readonly lastActivity: any | null | undefined;
							readonly name: string | null | undefined;
							readonly projectId: string | null | undefined;
							readonly totalSessions: number | null | undefined;
							readonly worktrees:
								| ReadonlyArray<{
										readonly isWorktree: boolean | null | undefined;
										readonly name: string | null | undefined;
										readonly path: string | null | undefined;
										readonly sessionCount: number | null | undefined;
								  }>
								| null
								| undefined;
					  }>
					| null
					| undefined;
				readonly repoId: string | null | undefined;
				readonly totalSessions: number | null | undefined;
		  }
		| null
		| undefined;
};
export type RepoDetailPageQuery = {
	response: RepoDetailPageQuery$data;
	variables: RepoDetailPageQuery$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = [
			{
				defaultValue: null,
				kind: "LocalArgument",
				name: "id",
			},
		],
		v1 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "id",
			storageKey: null,
		},
		v2 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "name",
			storageKey: null,
		},
		v3 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "path",
			storageKey: null,
		},
		v4 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "totalSessions",
			storageKey: null,
		},
		v5 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "lastActivity",
			storageKey: null,
		},
		v6 = [
			{
				alias: null,
				args: [
					{
						kind: "Variable",
						name: "id",
						variableName: "id",
					},
				],
				concreteType: "Repo",
				kind: "LinkedField",
				name: "repo",
				plural: false,
				selections: [
					v1 /*: any*/,
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "repoId",
						storageKey: null,
					},
					v2 /*: any*/,
					v3 /*: any*/,
					v4 /*: any*/,
					v5 /*: any*/,
					{
						alias: null,
						args: null,
						concreteType: "Project",
						kind: "LinkedField",
						name: "projects",
						plural: true,
						selections: [
							v1 /*: any*/,
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "projectId",
								storageKey: null,
							},
							v2 /*: any*/,
							v4 /*: any*/,
							v5 /*: any*/,
							{
								alias: null,
								args: null,
								concreteType: "Worktree",
								kind: "LinkedField",
								name: "worktrees",
								plural: true,
								selections: [
									v2 /*: any*/,
									v3 /*: any*/,
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "isWorktree",
										storageKey: null,
									},
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "sessionCount",
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
			name: "RepoDetailPageQuery",
			selections: v6 /*: any*/,
			type: "Query",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Operation",
			name: "RepoDetailPageQuery",
			selections: v6 /*: any*/,
		},
		params: {
			cacheID: "b74d08b63cad7c7751ac07e0e42c233d",
			id: null,
			metadata: {},
			name: "RepoDetailPageQuery",
			operationKind: "query",
			text: "query RepoDetailPageQuery(\n  $id: String!\n) {\n  repo(id: $id) {\n    id\n    repoId\n    name\n    path\n    totalSessions\n    lastActivity\n    projects {\n      id\n      projectId\n      name\n      totalSessions\n      lastActivity\n      worktrees {\n        name\n        path\n        isWorktree\n        sessionCount\n      }\n    }\n  }\n}\n",
		},
	};
})();

(node as any).hash = "8e05a981effd7f4a38c210c61edac5ef";

export default node;
