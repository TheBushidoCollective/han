/**
 * @generated SignedSource<<442cd609f0c775f361c7bd7feac617a9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionDetailContentSubscription$variables = {
  sessionId: string;
};
export type SessionDetailContentSubscription$data = {
  readonly sessionMessageAdded: {
    readonly messageIndex: number | null | undefined;
    readonly sessionId: string | null | undefined;
  } | null | undefined;
};
export type SessionDetailContentSubscription = {
  response: SessionDetailContentSubscription$data;
  variables: SessionDetailContentSubscription$variables;
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
    "name": "SessionDetailContentSubscription",
    "selections": (v1/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SessionDetailContentSubscription",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a6174eb838f3a336f67aed03e288618f",
    "id": null,
    "metadata": {},
    "name": "SessionDetailContentSubscription",
    "operationKind": "subscription",
    "text": "subscription SessionDetailContentSubscription(\n  $sessionId: ID!\n) {\n  sessionMessageAdded(sessionId: $sessionId) {\n    sessionId\n    messageIndex\n  }\n}\n"
  }
};
})();

(node as any).hash = "f9054b02e304855efeab9825d9a1601d";

export default node;
