/**
 * @generated SignedSource<<8b7b5de841d8f40c9f585d28b7828903>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionDetailContentTodosSubscription$variables = {
  sessionId: string;
};
export type SessionDetailContentTodosSubscription$data = {
  readonly sessionTodosChanged: {
    readonly completedCount: number;
    readonly inProgressCount: number;
    readonly sessionId: string;
    readonly todoCount: number;
  };
};
export type SessionDetailContentTodosSubscription = {
  response: SessionDetailContentTodosSubscription$data;
  variables: SessionDetailContentTodosSubscription$variables;
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
    "concreteType": "SessionTodosChangedPayload",
    "kind": "LinkedField",
    "name": "sessionTodosChanged",
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
        "name": "todoCount",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "inProgressCount",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "completedCount",
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
    "name": "SessionDetailContentTodosSubscription",
    "selections": (v1/*: any*/),
    "type": "SubscriptionRoot",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SessionDetailContentTodosSubscription",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "029c10f498710811159a86431dbc6457",
    "id": null,
    "metadata": {},
    "name": "SessionDetailContentTodosSubscription",
    "operationKind": "subscription",
    "text": "subscription SessionDetailContentTodosSubscription(\n  $sessionId: ID!\n) {\n  sessionTodosChanged(sessionId: $sessionId) {\n    sessionId\n    todoCount\n    inProgressCount\n    completedCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "f741e787eb505e93074483aedcd5487b";

export default node;
