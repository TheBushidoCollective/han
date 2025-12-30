/**
 * @generated SignedSource<<00f841925bcb5cfce48192f8e3546e7b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PluginScope = "LOCAL" | "PROJECT" | "USER" | "%future added value";
export type PluginsPageRemoveMutation$variables = {
  marketplace: string;
  name: string;
  scope: PluginScope;
};
export type PluginsPageRemoveMutation$data = {
  readonly removePlugin: {
    readonly message: string | null | undefined;
    readonly success: boolean | null | undefined;
  } | null | undefined;
};
export type PluginsPageRemoveMutation = {
  response: PluginsPageRemoveMutation$data;
  variables: PluginsPageRemoveMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "marketplace"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scope"
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "marketplace",
        "variableName": "marketplace"
      },
      {
        "kind": "Variable",
        "name": "name",
        "variableName": "name"
      },
      {
        "kind": "Variable",
        "name": "scope",
        "variableName": "scope"
      }
    ],
    "concreteType": "PluginMutationResult",
    "kind": "LinkedField",
    "name": "removePlugin",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "success",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "message",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "PluginsPageRemoveMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Operation",
    "name": "PluginsPageRemoveMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "a4ecffa3f3b5248ba90d778c53b70f9b",
    "id": null,
    "metadata": {},
    "name": "PluginsPageRemoveMutation",
    "operationKind": "mutation",
    "text": "mutation PluginsPageRemoveMutation(\n  $name: String!\n  $marketplace: String!\n  $scope: PluginScope!\n) {\n  removePlugin(name: $name, marketplace: $marketplace, scope: $scope) {\n    success\n    message\n  }\n}\n"
  }
};
})();

(node as any).hash = "2e424ff577fa53cad1674fabe0e73a73";

export default node;
