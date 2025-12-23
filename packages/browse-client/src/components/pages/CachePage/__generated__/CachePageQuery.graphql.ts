/**
 * @generated SignedSource<<edc1d553fd4bd5a36e9311f75c436ccc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CachePageQuery$variables = Record<PropertyKey, never>;
export type CachePageQuery$data = {
  readonly viewer: {
    readonly cacheEntries: ReadonlyArray<{
      readonly fileCount: number | null | undefined;
      readonly hookName: string | null | undefined;
      readonly id: string | null | undefined;
      readonly lastModified: any | null | undefined;
      readonly pluginName: string | null | undefined;
    }> | null | undefined;
    readonly cacheStats: {
      readonly newestEntry: any | null | undefined;
      readonly oldestEntry: any | null | undefined;
      readonly totalEntries: number | null | undefined;
      readonly totalFiles: number | null | undefined;
    } | null | undefined;
  } | null | undefined;
};
export type CachePageQuery = {
  response: CachePageQuery$data;
  variables: CachePageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "concreteType": "CacheEntry",
  "kind": "LinkedField",
  "name": "cacheEntries",
  "plural": true,
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "pluginName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hookName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "fileCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastModified",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "concreteType": "CacheStats",
  "kind": "LinkedField",
  "name": "cacheStats",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "totalEntries",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "totalFiles",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "oldestEntry",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "newestEntry",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "CachePageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "CachePageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v0/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d26a28cb561db3634e7c4c593d72624f",
    "id": null,
    "metadata": {},
    "name": "CachePageQuery",
    "operationKind": "query",
    "text": "query CachePageQuery {\n  viewer {\n    cacheEntries {\n      id\n      pluginName\n      hookName\n      fileCount\n      lastModified\n    }\n    cacheStats {\n      totalEntries\n      totalFiles\n      oldestEntry\n      newestEntry\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "85c0a067e3372a45392d8d756daf24aa";

export default node;
