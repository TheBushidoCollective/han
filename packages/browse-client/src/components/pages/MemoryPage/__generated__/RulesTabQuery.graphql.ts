/**
 * @generated SignedSource<<8ca887df1f4dedbec51ac0d177f28987>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RuleScope = "PROJECT" | "USER" | "%future added value";
export type RulesTabQuery$variables = Record<PropertyKey, never>;
export type RulesTabQuery$data = {
  readonly viewer: {
    readonly memory: {
      readonly rules: ReadonlyArray<{
        readonly content: string | null | undefined;
        readonly domain: string | null | undefined;
        readonly id: string | null | undefined;
        readonly path: string | null | undefined;
        readonly scope: RuleScope | null | undefined;
        readonly size: number | null | undefined;
      }> | null | undefined;
    } | null | undefined;
  } | null | undefined;
};
export type RulesTabQuery = {
  response: RulesTabQuery$data;
  variables: RulesTabQuery$variables;
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
  "concreteType": "MemoryQuery",
  "kind": "LinkedField",
  "name": "memory",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Rule",
      "kind": "LinkedField",
      "name": "rules",
      "plural": true,
      "selections": [
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "domain",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "scope",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "path",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "content",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "size",
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
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RulesTabQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v1/*: any*/)
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
    "name": "RulesTabQuery",
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
          (v0/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "6451aa7cc34df1926b5972a931b0d844",
    "id": null,
    "metadata": {},
    "name": "RulesTabQuery",
    "operationKind": "query",
    "text": "query RulesTabQuery {\n  viewer {\n    memory {\n      rules {\n        id\n        domain\n        scope\n        path\n        content\n        size\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "1592bc61da5b77cee08bc22e967c0fa5";

export default node;
