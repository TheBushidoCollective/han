/**
 * @generated SignedSource<<bd91fcbf3f8a4cd3773a1acad2990125>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CacheContentQuery$variables = Record<PropertyKey, never>;
export type CacheContentQuery$data = {
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
};
export type CacheContentQuery = {
  response: CacheContentQuery$data;
  variables: CacheContentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "CacheEntry",
    "kind": "LinkedField",
    "name": "cacheEntries",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
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
  {
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
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "CacheContentQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "CacheContentQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "c6b3cd1b00845aab93dbb64a34adbc9f",
    "id": null,
    "metadata": {},
    "name": "CacheContentQuery",
    "operationKind": "query",
    "text": "query CacheContentQuery {\n  cacheEntries {\n    id\n    pluginName\n    hookName\n    fileCount\n    lastModified\n  }\n  cacheStats {\n    totalEntries\n    totalFiles\n    oldestEntry\n    newestEntry\n  }\n}\n"
  }
};
})();

(node as any).hash = "78b2911048d49b35bce1e498d424346f";

export default node;
