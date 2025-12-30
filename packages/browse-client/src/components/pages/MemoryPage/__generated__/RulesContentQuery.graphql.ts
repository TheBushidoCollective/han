/**
 * @generated SignedSource<<bb50fd415d38c312c74199008c9287a7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RuleScope = "PROJECT" | "USER" | "%future added value";
export type RulesContentQuery$variables = Record<PropertyKey, never>;
export type RulesContentQuery$data = {
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
};
export type RulesContentQuery = {
  response: RulesContentQuery$data;
  variables: RulesContentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
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
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RulesContentQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RulesContentQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "8cbcd47fe7b36ac3f75fe690ed05af7e",
    "id": null,
    "metadata": {},
    "name": "RulesContentQuery",
    "operationKind": "query",
    "text": "query RulesContentQuery {\n  memory {\n    rules {\n      id\n      domain\n      scope\n      path\n      content\n      size\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8fe8ca72b3ecfdfee467b57123e4c825";

export default node;
