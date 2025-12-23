/**
 * @generated SignedSource<<7235159cb9bfd78b758392bfda34c3b1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Confidence = "HIGH" | "LOW" | "MEDIUM" | "%future added value";
export type MemoryLayer = "OBSERVATIONS" | "RULES" | "SUMMARIES" | "TEAM" | "TRANSCRIPTS" | "%future added value";
export type MemorySource = "COMBINED" | "PERSONAL" | "RULES" | "TEAM" | "TRANSCRIPTS" | "%future added value";
export type SearchTabQuery$variables = {
  query: string;
};
export type SearchTabQuery$data = {
  readonly viewer: {
    readonly memory: {
      readonly search: {
        readonly answer: string | null | undefined;
        readonly caveats: ReadonlyArray<string> | null | undefined;
        readonly citations: ReadonlyArray<{
          readonly author: string | null | undefined;
          readonly excerpt: string | null | undefined;
          readonly layer: MemoryLayer | null | undefined;
          readonly source: string | null | undefined;
          readonly timestamp: any | null | undefined;
        }> | null | undefined;
        readonly confidence: Confidence | null | undefined;
        readonly layersSearched: ReadonlyArray<MemoryLayer> | null | undefined;
        readonly source: MemorySource | null | undefined;
      } | null | undefined;
    } | null | undefined;
  } | null | undefined;
};
export type SearchTabQuery = {
  response: SearchTabQuery$data;
  variables: SearchTabQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "query"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "source",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "concreteType": "MemoryQuery",
  "kind": "LinkedField",
  "name": "memory",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "query",
          "variableName": "query"
        }
      ],
      "concreteType": "MemorySearchResult",
      "kind": "LinkedField",
      "name": "search",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "answer",
          "storageKey": null
        },
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "confidence",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "caveats",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "layersSearched",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "Citation",
          "kind": "LinkedField",
          "name": "citations",
          "plural": true,
          "selections": [
            (v1/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "excerpt",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "author",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "timestamp",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "layer",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SearchTabQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SearchTabQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5c7f5b68027a2dbfb04e3dba0df2bf3d",
    "id": null,
    "metadata": {},
    "name": "SearchTabQuery",
    "operationKind": "query",
    "text": "query SearchTabQuery(\n  $query: String!\n) {\n  viewer {\n    memory {\n      search(query: $query) {\n        answer\n        source\n        confidence\n        caveats\n        layersSearched\n        citations {\n          source\n          excerpt\n          author\n          timestamp\n          layer\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "9ff4c969ad048f98781b4ff3aa9a6ba6";

export default node;
