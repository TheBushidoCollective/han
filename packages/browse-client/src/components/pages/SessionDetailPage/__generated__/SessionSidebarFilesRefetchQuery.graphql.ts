/**
 * @generated SignedSource<<890a3bce7b405ede355249496ee6ff3f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest, FragmentRefs } from "relay-runtime";
export type SessionSidebarFilesRefetchQuery$variables = {
	after?: string | null | undefined;
	first?: number | null | undefined;
	id: string;
};
export type SessionSidebarFilesRefetchQuery$data = {
	readonly node:
		| {
				readonly " $fragmentSpreads": FragmentRefs<"SessionSidebar_fileChanges">;
		  }
		| null
		| undefined;
};
export type SessionSidebarFilesRefetchQuery = {
	response: SessionSidebarFilesRefetchQuery$data;
	variables: SessionSidebarFilesRefetchQuery$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = [
			{
				defaultValue: null,
				kind: "LocalArgument",
				name: "after",
			},
			{
				defaultValue: 50,
				kind: "LocalArgument",
				name: "first",
			},
			{
				defaultValue: null,
				kind: "LocalArgument",
				name: "id",
			},
		],
		v1 = [
			{
				kind: "Variable",
				name: "id",
				variableName: "id",
			},
		],
		v2 = [
			{
				kind: "Variable",
				name: "after",
				variableName: "after",
			},
			{
				kind: "Variable",
				name: "first",
				variableName: "first",
			},
		],
		v3 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "__typename",
			storageKey: null,
		},
		v4 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "id",
			storageKey: null,
		},
		v5 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "pluginName",
			storageKey: null,
		},
		v6 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "hookName",
			storageKey: null,
		};
	return {
		fragment: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Fragment",
			metadata: null,
			name: "SessionSidebarFilesRefetchQuery",
			selections: [
				{
					alias: null,
					args: v1 /*: any*/,
					concreteType: null,
					kind: "LinkedField",
					name: "node",
					plural: false,
					selections: [
						{
							args: v2 /*: any*/,
							kind: "FragmentSpread",
							name: "SessionSidebar_fileChanges",
						},
					],
					storageKey: null,
				},
			],
			type: "Query",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Operation",
			name: "SessionSidebarFilesRefetchQuery",
			selections: [
				{
					alias: null,
					args: v1 /*: any*/,
					concreteType: null,
					kind: "LinkedField",
					name: "node",
					plural: false,
					selections: [
						v3 /*: any*/,
						v4 /*: any*/,
						{
							kind: "InlineFragment",
							selections: [
								{
									alias: null,
									args: v2 /*: any*/,
									concreteType: "FileChangeConnection",
									kind: "LinkedField",
									name: "fileChanges",
									plural: false,
									selections: [
										{
											alias: null,
											args: null,
											kind: "ScalarField",
											name: "totalCount",
											storageKey: null,
										},
										{
											alias: null,
											args: null,
											concreteType: "FileChangeEdge",
											kind: "LinkedField",
											name: "edges",
											plural: true,
											selections: [
												{
													alias: null,
													args: null,
													concreteType: "FileChange",
													kind: "LinkedField",
													name: "node",
													plural: false,
													selections: [
														v4 /*: any*/,
														{
															alias: null,
															args: null,
															kind: "ScalarField",
															name: "filePath",
															storageKey: null,
														},
														{
															alias: null,
															args: null,
															kind: "ScalarField",
															name: "action",
															storageKey: null,
														},
														{
															alias: null,
															args: null,
															kind: "ScalarField",
															name: "toolName",
															storageKey: null,
														},
														{
															alias: null,
															args: null,
															kind: "ScalarField",
															name: "recordedAt",
															storageKey: null,
														},
														{
															alias: null,
															args: null,
															kind: "ScalarField",
															name: "isValidated",
															storageKey: null,
														},
														{
															alias: null,
															args: null,
															concreteType: "FileValidation",
															kind: "LinkedField",
															name: "validations",
															plural: true,
															selections: [
																v5 /*: any*/,
																v6 /*: any*/,
																{
																	alias: null,
																	args: null,
																	kind: "ScalarField",
																	name: "validatedAt",
																	storageKey: null,
																},
															],
															storageKey: null,
														},
														{
															alias: null,
															args: null,
															concreteType: "FileValidation",
															kind: "LinkedField",
															name: "missingValidations",
															plural: true,
															selections: [v5 /*: any*/, v6 /*: any*/],
															storageKey: null,
														},
														v3 /*: any*/,
													],
													storageKey: null,
												},
												{
													alias: null,
													args: null,
													kind: "ScalarField",
													name: "cursor",
													storageKey: null,
												},
											],
											storageKey: null,
										},
										{
											alias: null,
											args: null,
											concreteType: "PageInfo",
											kind: "LinkedField",
											name: "pageInfo",
											plural: false,
											selections: [
												{
													alias: null,
													args: null,
													kind: "ScalarField",
													name: "hasNextPage",
													storageKey: null,
												},
												{
													alias: null,
													args: null,
													kind: "ScalarField",
													name: "endCursor",
													storageKey: null,
												},
											],
											storageKey: null,
										},
									],
									storageKey: null,
								},
								{
									alias: null,
									args: v2 /*: any*/,
									filters: null,
									handle: "connection",
									key: "SessionSidebar_fileChanges",
									kind: "LinkedHandle",
									name: "fileChanges",
								},
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "fileChangeCount",
									storageKey: null,
								},
							],
							type: "Session",
							abstractKey: null,
						},
					],
					storageKey: null,
				},
			],
		},
		params: {
			cacheID: "bd63c081ae9ba2d0f8a056e86ff75a3d",
			id: null,
			metadata: {},
			name: "SessionSidebarFilesRefetchQuery",
			operationKind: "query",
			text: "query SessionSidebarFilesRefetchQuery(\n  $after: String\n  $first: Int = 50\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...SessionSidebar_fileChanges_2HEEH6\n    id\n  }\n}\n\nfragment SessionSidebar_fileChanges_2HEEH6 on Session {\n  fileChanges(first: $first, after: $after) {\n    totalCount\n    edges {\n      node {\n        id\n        filePath\n        action\n        toolName\n        recordedAt\n        isValidated\n        validations {\n          pluginName\n          hookName\n          validatedAt\n        }\n        missingValidations {\n          pluginName\n          hookName\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  fileChangeCount\n  id\n}\n",
		},
	};
})();

(node as any).hash = "10f6f88bc40e37d960a637f1f32704ef";

export default node;
