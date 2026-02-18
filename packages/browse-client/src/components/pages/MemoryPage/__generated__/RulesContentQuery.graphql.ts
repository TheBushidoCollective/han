/**
 * @generated SignedSource<<338ad06efcea0df14809868f3d6d9afb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RulesContentQuery$variables = Record<PropertyKey, never>;
export type RulesContentQuery$data = {
  readonly memory: {
    readonly rules: ReadonlyArray<{
      readonly content: string | null | undefined;
      readonly domain: string | null | undefined;
      readonly id: string | null | undefined;
      readonly path: string | null | undefined;
      readonly projectName: string | null | undefined;
      readonly projectPath: string | null | undefined;
      readonly scope: string | null | undefined;
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
        "concreteType": "MemoryRule",
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "projectPath",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "projectName",
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
    "cacheID": "4aab20cbed498bf73c763d0b2d4a198c",
    "id": null,
    "metadata": {},
    "name": "RulesContentQuery",
    "operationKind": "query",
    "text": "query RulesContentQuery {\n  memory {\n    rules {\n      id\n      domain\n      scope\n      path\n      content\n      size\n      projectPath\n      projectName\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "425b3fa26625a8cb785cd938f24672dc";

export default node;
