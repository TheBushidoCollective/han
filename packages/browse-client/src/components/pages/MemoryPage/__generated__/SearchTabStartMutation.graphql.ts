/**
 * @generated SignedSource<<dd7fb243ae8074a6307d668353d28d97>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SearchTabStartMutation$variables = {
  model?: string | null | undefined;
  question: string;
};
export type SearchTabStartMutation$data = {
  readonly startMemoryQuery: {
    readonly message: string | null | undefined;
    readonly sessionId: string | null | undefined;
    readonly success: boolean | null | undefined;
  } | null | undefined;
};
export type SearchTabStartMutation = {
  response: SearchTabStartMutation$data;
  variables: SearchTabStartMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "model"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "question"
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "model",
        "variableName": "model"
      },
      {
        "kind": "Variable",
        "name": "question",
        "variableName": "question"
      }
    ],
    "concreteType": "MemoryQueryStartResult",
    "kind": "LinkedField",
    "name": "startMemoryQuery",
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
        "name": "success",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "message",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SearchTabStartMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "SearchTabStartMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "9340286c68e67bd206f758aa5bf7d8ab",
    "id": null,
    "metadata": {},
    "name": "SearchTabStartMutation",
    "operationKind": "mutation",
    "text": "mutation SearchTabStartMutation(\n  $question: String!\n  $model: String\n) {\n  startMemoryQuery(question: $question, model: $model) {\n    sessionId\n    success\n    message\n  }\n}\n"
  }
};
})();

(node as any).hash = "937941697d6bf9c0224d2477271e72c8";

export default node;
