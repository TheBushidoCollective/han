/**
 * @generated SignedSource<<bb81ae6055bafb40b92ca11389e57b19>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EventAction = "CREATED" | "DELETED" | "UPDATED" | "%future added value";
export type MemoryEventType = "OBSERVATION" | "RELOAD" | "RULE" | "SESSION" | "SUMMARY" | "%future added value";
export type SessionDetailPageSubscription$variables = Record<PropertyKey, never>;
export type SessionDetailPageSubscription$data = {
  readonly memoryUpdated: {
    readonly action: EventAction | null | undefined;
    readonly path: string | null | undefined;
    readonly timestamp: string | null | undefined;
    readonly type: MemoryEventType | null | undefined;
  } | null | undefined;
};
export type SessionDetailPageSubscription = {
  response: SessionDetailPageSubscription$data;
  variables: SessionDetailPageSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "MemoryEvent",
    "kind": "LinkedField",
    "name": "memoryUpdated",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "type",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "action",
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
        "name": "timestamp",
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
    "name": "SessionDetailPageSubscription",
    "selections": (v0/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SessionDetailPageSubscription",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "206806466b5099a222dae95bea2b3bd1",
    "id": null,
    "metadata": {},
    "name": "SessionDetailPageSubscription",
    "operationKind": "subscription",
    "text": "subscription SessionDetailPageSubscription {\n  memoryUpdated {\n    type\n    action\n    path\n    timestamp\n  }\n}\n"
  }
};
})();

(node as any).hash = "a4dee1cf8de2a8b3480a63016102ee98";

export default node;
