/**
 * @generated SignedSource<<071f49f0c6c033bcd0653acbc93bbb20>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionDetailContentFilesSubscription$variables = {
  sessionId: string;
};
export type SessionDetailContentFilesSubscription$data = {
  readonly sessionFilesChanged: {
    readonly fileCount: number | null | undefined;
    readonly sessionId: string | null | undefined;
    readonly toolName: string | null | undefined;
  } | null | undefined;
};
export type SessionDetailContentFilesSubscription = {
  response: SessionDetailContentFilesSubscription$data;
  variables: SessionDetailContentFilesSubscription$variables;
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
    "concreteType": "SessionFilesChangedPayload",
    "kind": "LinkedField",
    "name": "sessionFilesChanged",
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
        "name": "fileCount",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "toolName",
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
    "name": "SessionDetailContentFilesSubscription",
    "selections": (v1/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SessionDetailContentFilesSubscription",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "88953dacdfb6b12cead404248aea50fc",
    "id": null,
    "metadata": {},
    "name": "SessionDetailContentFilesSubscription",
    "operationKind": "subscription",
    "text": "subscription SessionDetailContentFilesSubscription(\n  $sessionId: ID!\n) {\n  sessionFilesChanged(sessionId: $sessionId) {\n    sessionId\n    fileCount\n    toolName\n  }\n}\n"
  }
};
})();

(node as any).hash = "7be38c6f3b11e29dc7f50d174e2cb445";

export default node;
