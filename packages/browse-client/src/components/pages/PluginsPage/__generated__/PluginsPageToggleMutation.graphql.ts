/**
 * @generated SignedSource<<61396342575f792435fd58bc68977fe7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PluginScope = "LOCAL" | "PROJECT" | "USER" | "%future added value";
export type PluginsPageToggleMutation$variables = {
  enabled: boolean;
  marketplace: string;
  name: string;
  scope: PluginScope;
};
export type PluginsPageToggleMutation$data = {
  readonly togglePlugin: {
    readonly message: string | null | undefined;
    readonly success: boolean | null | undefined;
  } | null | undefined;
};
export type PluginsPageToggleMutation = {
  response: PluginsPageToggleMutation$data;
  variables: PluginsPageToggleMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "enabled"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "marketplace"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scope"
},
v4 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "enabled",
        "variableName": "enabled"
      },
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
    "name": "togglePlugin",
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
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "PluginsPageToggleMutation",
    "selections": (v4/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v1/*: any*/),
      (v3/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "PluginsPageToggleMutation",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "3fe3100fc5a4c6359e88ba8c0ed4a4d1",
    "id": null,
    "metadata": {},
    "name": "PluginsPageToggleMutation",
    "operationKind": "mutation",
    "text": "mutation PluginsPageToggleMutation(\n  $name: String!\n  $marketplace: String!\n  $scope: PluginScope!\n  $enabled: Boolean!\n) {\n  togglePlugin(name: $name, marketplace: $marketplace, scope: $scope, enabled: $enabled) {\n    success\n    message\n  }\n}\n"
  }
};
})();

(node as any).hash = "eb22dcd67ffeb6b4333d4fdc22d29e2d";

export default node;
