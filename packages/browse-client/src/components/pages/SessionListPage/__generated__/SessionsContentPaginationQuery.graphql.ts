/**
 * @generated SignedSource<<8cc24b387e0d51a825184a3cfc943cad>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionsContentPaginationQuery$variables = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  projectId?: string | null | undefined;
  worktreeName?: string | null | undefined;
};
export type SessionsContentPaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"SessionsContent_query">;
};
export type SessionsContentPaginationQuery = {
  response: SessionsContentPaginationQuery$data;
  variables: SessionsContentPaginationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": 50,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "worktreeName"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  {
    "kind": "Variable",
    "name": "projectId",
    "variableName": "projectId"
  },
  {
    "kind": "Variable",
    "name": "worktreeName",
    "variableName": "worktreeName"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalCount",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionsContentPaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "SessionsContent_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SessionsContentPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SessionConnection",
        "kind": "LinkedField",
        "name": "sessions",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "SessionEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Session",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
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
                    "name": "projectName",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "worktreeName",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "summary",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "updatedAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "startedAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "gitBranch",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "name",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "projectSlug",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "projectId",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "messageCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Todo",
                    "kind": "LinkedField",
                    "name": "currentTodo",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "content",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "activeForm",
                        "storageKey": null
                      },
                      (v3/*: any*/),
                      (v2/*: any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "TaskConnection",
                    "kind": "LinkedField",
                    "name": "activeTasks",
                    "plural": false,
                    "selections": [
                      (v4/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "TaskEdge",
                        "kind": "LinkedField",
                        "name": "edges",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Task",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v2/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "taskId",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "description",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "type",
                                "storageKey": null
                              },
                              (v3/*: any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "TodoCounts",
                    "kind": "LinkedField",
                    "name": "todoCounts",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "total",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "pending",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "inProgress",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "completed",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endCursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v4/*: any*/),
          {
            "kind": "ClientExtension",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__id",
                "storageKey": null
              }
            ]
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "filters": [
          "projectId",
          "worktreeName"
        ],
        "handle": "connection",
        "key": "SessionsContent_sessions",
        "kind": "LinkedHandle",
        "name": "sessions"
      }
    ]
  },
  "params": {
    "cacheID": "72c9460b9f7707b2aa5279860842e2dc",
    "id": null,
    "metadata": {},
    "name": "SessionsContentPaginationQuery",
    "operationKind": "query",
    "text": "query SessionsContentPaginationQuery(\n  $after: String\n  $first: Int = 50\n  $projectId: String\n  $worktreeName: String\n) {\n  ...SessionsContent_query_2ZTWZT\n}\n\nfragment SessionListItem_session on Session {\n  id\n  sessionId\n  name\n  projectName\n  projectSlug\n  projectId\n  worktreeName\n  summary\n  messageCount\n  startedAt\n  updatedAt\n  currentTodo {\n    content\n    activeForm\n    status\n    id\n  }\n  activeTasks {\n    totalCount\n    edges {\n      node {\n        id\n        taskId\n        description\n        type\n        status\n      }\n    }\n  }\n  todoCounts {\n    total\n    pending\n    inProgress\n    completed\n  }\n}\n\nfragment SessionsContent_query_2ZTWZT on Query {\n  sessions(first: $first, after: $after, projectId: $projectId, worktreeName: $worktreeName) {\n    edges {\n      node {\n        id\n        sessionId\n        projectName\n        worktreeName\n        summary\n        updatedAt\n        startedAt\n        gitBranch\n        ...SessionListItem_session\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "ebd12c3104a5b2b59fdd22be4e683259";

export default node;
