/**
 * @generated SignedSource<<ba635ad2a7ccdf74ede60f84ebe4ec97>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DashboardContentSubscription$variables = Record<PropertyKey, never>;
export type DashboardContentSubscription$data = {
  readonly memoryUpdated: {
    readonly action: string | null | undefined;
    readonly path: string | null | undefined;
    readonly timestamp: string | null | undefined;
    readonly type: string | null | undefined;
  };
};
export type DashboardContentSubscription = {
  response: DashboardContentSubscription$data;
  variables: DashboardContentSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "MemoryUpdatedPayload",
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
    "name": "DashboardContentSubscription",
    "selections": (v0/*: any*/),
    "type": "SubscriptionRoot",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DashboardContentSubscription",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "4a29d23d78365967d44f82db4fcc5039",
    "id": null,
    "metadata": {},
    "name": "DashboardContentSubscription",
    "operationKind": "subscription",
    "text": "subscription DashboardContentSubscription {\n  memoryUpdated {\n    type\n    action\n    path\n    timestamp\n  }\n}\n"
  }
};
})();

(node as any).hash = "dbe6056e6d9082b9fbf97f1ee1c3e2f0";

export default node;
