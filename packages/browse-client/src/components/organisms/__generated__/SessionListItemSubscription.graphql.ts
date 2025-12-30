/**
 * @generated SignedSource<<511f78be10fd4af9c5ff74d1c3827202>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionListItemSubscription$variables = {
  sessionId: string;
};
export type SessionListItemSubscription$data = {
  readonly nodeUpdated: {
    readonly id: string | null | undefined;
    readonly typename: string | null | undefined;
  } | null | undefined;
};
export type SessionListItemSubscription = {
  response: SessionListItemSubscription$data;
  variables: SessionListItemSubscription$variables;
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
        "name": "id",
        "variableName": "sessionId"
      }
    ],
    "concreteType": "NodeUpdatedPayload",
    "kind": "LinkedField",
    "name": "nodeUpdated",
    "plural": false,
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
        "name": "typename",
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
    "name": "SessionListItemSubscription",
    "selections": (v1/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SessionListItemSubscription",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "25e8f369c6274f31a476de7b2a77239f",
    "id": null,
    "metadata": {},
    "name": "SessionListItemSubscription",
    "operationKind": "subscription",
    "text": "subscription SessionListItemSubscription(\n  $sessionId: ID!\n) {\n  nodeUpdated(id: $sessionId) {\n    id\n    typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "b08bb1598280551f1cbd236f4f2c2eeb";

export default node;
