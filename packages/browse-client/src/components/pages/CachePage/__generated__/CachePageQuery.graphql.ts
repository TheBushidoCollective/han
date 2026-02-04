/**
 * @generated SignedSource<<921f4af94abcbb3e7f257e5dad964b1d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type CachePageQuery$variables = Record<PropertyKey, never>;
export type CachePageQuery$data = {
	readonly cacheEntries:
		| ReadonlyArray<{
				readonly fileCount: number | null | undefined;
				readonly hookName: string | null | undefined;
				readonly id: string | null | undefined;
				readonly lastModified: any | null | undefined;
				readonly pluginName: string | null | undefined;
		  }>
		| null
		| undefined;
	readonly cacheStats:
		| {
				readonly newestEntry: any | null | undefined;
				readonly oldestEntry: any | null | undefined;
				readonly totalEntries: number | null | undefined;
				readonly totalFiles: number | null | undefined;
		  }
		| null
		| undefined;
};
export type CachePageQuery = {
	response: CachePageQuery$data;
	variables: CachePageQuery$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = [
		{
			alias: null,
			args: null,
			concreteType: "CacheEntry",
			kind: "LinkedField",
			name: "cacheEntries",
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
					name: "pluginName",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "hookName",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "fileCount",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "lastModified",
					storageKey: null,
				},
			],
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			concreteType: "CacheStats",
			kind: "LinkedField",
			name: "cacheStats",
			plural: false,
			selections: [
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "totalEntries",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "totalFiles",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "oldestEntry",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "newestEntry",
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
			name: "CachePageQuery",
			selections: v0 /*: any*/,
			type: "Query",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: [],
			kind: "Operation",
			name: "CachePageQuery",
			selections: v0 /*: any*/,
		},
		params: {
			cacheID: "8e7c318bdcb8dc49757c00ef72b40f23",
			id: null,
			metadata: {},
			name: "CachePageQuery",
			operationKind: "query",
			text: "query CachePageQuery {\n  cacheEntries {\n    id\n    pluginName\n    hookName\n    fileCount\n    lastModified\n  }\n  cacheStats {\n    totalEntries\n    totalFiles\n    oldestEntry\n    newestEntry\n  }\n}\n",
		},
	};
})();

(node as any).hash = "9390d35ab478823131644b01a7904acd";

export default node;
