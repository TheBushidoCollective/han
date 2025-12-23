/**
 * @generated SignedSource<<2bbcf9fd44e1ce396d9765ab6921551b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionMessagesSubscription$variables = {
  sessionId: string;
};
export type SessionMessagesSubscription$data = {
  readonly sessionMessageAdded: {
    readonly messageIndex: number | null | undefined;
    readonly sessionId: string | null | undefined;
  } | null | undefined;
};
export type SessionMessagesSubscription = {
  response: SessionMessagesSubscription$data;
  variables: SessionMessagesSubscription$variables;
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
    "concreteType": "SessionMessageAddedPayload",
    "kind": "LinkedField",
    "name": "sessionMessageAdded",
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
        "name": "messageIndex",
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
    "name": "SessionMessagesSubscription",
    "selections": (v1/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SessionMessagesSubscription",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1e2c09b2fa5eda0d79c4e84f16ccce80",
    "id": null,
    "metadata": {},
    "name": "SessionMessagesSubscription",
    "operationKind": "subscription",
    "text": "subscription SessionMessagesSubscription(\n  $sessionId: ID!\n) {\n  sessionMessageAdded(sessionId: $sessionId) {\n    sessionId\n    messageIndex\n  }\n}\n"
  }
};
})();

(node as any).hash = "0d876a6f8658ce77296c38e18972a6f4";

export default node;
