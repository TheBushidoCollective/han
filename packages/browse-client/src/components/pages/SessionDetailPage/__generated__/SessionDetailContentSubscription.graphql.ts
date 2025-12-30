/**
 * @generated SignedSource<<954ffe362b3242858a25bf9efd6e56c4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EventAction = "CREATED" | "DELETED" | "UPDATED" | "%future added value";
export type MemoryEventType = "OBSERVATION" | "RELOAD" | "RULE" | "SESSION" | "SUMMARY" | "%future added value";
export type SessionDetailContentSubscription$variables = Record<PropertyKey, never>;
export type SessionDetailContentSubscription$data = {
  readonly memoryUpdated: {
    readonly action: EventAction | null | undefined;
    readonly path: string | null | undefined;
    readonly timestamp: string | null | undefined;
    readonly type: MemoryEventType | null | undefined;
  } | null | undefined;
};
export type SessionDetailContentSubscription = {
  response: SessionDetailContentSubscription$data;
  variables: SessionDetailContentSubscription$variables;
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
    "name": "SessionDetailContentSubscription",
    "selections": (v0/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SessionDetailContentSubscription",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "9f1dc0e8c92d594a83399381cf5f1b08",
    "id": null,
    "metadata": {},
    "name": "SessionDetailContentSubscription",
    "operationKind": "subscription",
    "text": "subscription SessionDetailContentSubscription {\n  memoryUpdated {\n    type\n    action\n    path\n    timestamp\n  }\n}\n"
  }
};
})();

(node as any).hash = "7f51386f8f7b372abfc07ce22746c34f";

export default node;
