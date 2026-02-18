/**
 * @generated SignedSource<<fd6f52e4665351316a6c85c30ca489f1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionDetailContentHooksSubscription$variables = {
  sessionId: string;
};
export type SessionDetailContentHooksSubscription$data = {
  readonly sessionHooksChanged: {
    readonly eventType: string;
    readonly hookName: string;
    readonly pluginName: string;
    readonly sessionId: string;
  };
};
export type SessionDetailContentHooksSubscription = {
  response: SessionDetailContentHooksSubscription$data;
  variables: SessionDetailContentHooksSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "sessionId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "sessionId",
        "variableName": "sessionId"
      }
    ],
    "concreteType": "SessionHooksChangedPayload",
    "kind": "LinkedField",
    "name": "sessionHooksChanged",
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
        "name": "eventType",
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
    "name": "SessionDetailContentHooksSubscription",
    "selections": (v1/*: any*/),
    "type": "SubscriptionRoot",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SessionDetailContentHooksSubscription",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "0797963d0c2f3c641ee107c1e7e9aee5",
    "id": null,
    "metadata": {},
    "name": "SessionDetailContentHooksSubscription",
    "operationKind": "subscription",
    "text": "subscription SessionDetailContentHooksSubscription(\n  $sessionId: ID!\n) {\n  sessionHooksChanged(sessionId: $sessionId) {\n    sessionId\n    pluginName\n    hookName\n    eventType\n  }\n}\n"
  }
};
})();

(node as any).hash = "cf5d93241f67b9bd01858bd26a25e83a";

export default node;
