/**
 * @generated SignedSource<<842c3f7c626b8e30f56be42ca585e0c7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type HookRunMessageCardResultSubscription$variables = {
  hookRunId: string;
};
export type HookRunMessageCardResultSubscription$data = {
  readonly hookResultAdded: {
    readonly durationMs: number | null | undefined;
    readonly hookName: string | null | undefined;
    readonly hookRunId: string | null | undefined;
    readonly pluginName: string | null | undefined;
    readonly sessionId: string | null | undefined;
    readonly success: boolean | null | undefined;
  } | null | undefined;
};
export type HookRunMessageCardResultSubscription = {
  response: HookRunMessageCardResultSubscription$data;
  variables: HookRunMessageCardResultSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "hookRunId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "hookRunId",
        "variableName": "hookRunId"
      }
    ],
    "concreteType": "HookResultAddedPayload",
    "kind": "LinkedField",
    "name": "hookResultAdded",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "sessionId",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "hookRunId",
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
        "name": "success",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "durationMs",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "HookRunMessageCardResultSubscription",
    "selections": (v1/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "HookRunMessageCardResultSubscription",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "051f03b0dec90af18fd16afe2fc7a706",
    "id": null,
    "metadata": {},
    "name": "HookRunMessageCardResultSubscription",
    "operationKind": "subscription",
    "text": "subscription HookRunMessageCardResultSubscription(\n  $hookRunId: String!\n) {\n  hookResultAdded(hookRunId: $hookRunId) {\n    sessionId\n    hookRunId\n    pluginName\n    hookName\n    success\n    durationMs\n  }\n}\n"
  }
};
})();

(node as any).hash = "4de9323dace4a25bc6e3f736b93d8e33";

export default node;
