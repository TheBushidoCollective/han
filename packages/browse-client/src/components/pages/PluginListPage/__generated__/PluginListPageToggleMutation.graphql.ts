/**
 * @generated SignedSource<<86cb6e225a88d7b42f17dad0d390f4d3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PluginScope = "LOCAL" | "PROJECT" | "USER" | "%future added value";
export type PluginListPageToggleMutation$variables = {
  enabled: boolean;
  marketplace: string;
  name: string;
  scope: PluginScope;
};
export type PluginListPageToggleMutation$data = {
  readonly togglePlugin: {
    readonly message: string | null | undefined;
    readonly success: boolean | null | undefined;
  } | null | undefined;
};
export type PluginListPageToggleMutation = {
  response: PluginListPageToggleMutation$data;
  variables: PluginListPageToggleMutation$variables;
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
    "name": "PluginListPageToggleMutation",
    "selections": (v4/*: any*/),
    "type": "MutationRoot",
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
    "name": "PluginListPageToggleMutation",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "56e1cc1fb308f861676c61232063ef61",
    "id": null,
    "metadata": {},
    "name": "PluginListPageToggleMutation",
    "operationKind": "mutation",
    "text": "mutation PluginListPageToggleMutation(\n  $name: String!\n  $marketplace: String!\n  $scope: PluginScope!\n  $enabled: Boolean!\n) {\n  togglePlugin(name: $name, marketplace: $marketplace, scope: $scope, enabled: $enabled) {\n    success\n    message\n  }\n}\n"
  }
};
})();

(node as any).hash = "5df5c13bd80bdf442731792e684ba005";

export default node;
