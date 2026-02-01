/**
 * @generated SignedSource<<fcb9317b528976731ac9a8fe79fd8204>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionDetailPageQuery$variables = {
  id: string;
};
export type SessionDetailPageQuery$data = {
  readonly node: {
    readonly date?: string | null | undefined;
    readonly gitBranch?: string | null | undefined;
    readonly id?: string;
    readonly messageCount?: number | null | undefined;
    readonly name?: string | null | undefined;
    readonly orgId?: string | null | undefined;
    readonly owner?: {
      readonly avatarUrl: string | null | undefined;
      readonly email: string | null | undefined;
      readonly id: string | null | undefined;
      readonly name: string | null | undefined;
    } | null | undefined;
    readonly projectId?: string | null | undefined;
    readonly projectName?: string | null | undefined;
    readonly projectPath?: string | null | undefined;
    readonly sessionId?: string | null | undefined;
    readonly startedAt?: any | null | undefined;
    readonly summary?: string | null | undefined;
    readonly updatedAt?: any | null | undefined;
    readonly version?: string | null | undefined;
    readonly worktreeName?: string | null | undefined;
    readonly " $fragmentSpreads": FragmentRefs<"SessionMessages_session" | "SessionSidebar_session">;
  } | null | undefined;
};
export type SessionDetailPageQuery = {
  response: SessionDetailPageQuery$data;
  variables: SessionDetailPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
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
  "name": "sessionId",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "date",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectName",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectPath",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectId",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "worktreeName",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "summary",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messageCount",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "gitBranch",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "version",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "orgId",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "owner",
  "plural": false,
  "selections": [
    (v2/*: any*/),
    (v4/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "email",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "avatarUrl",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v19 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "timestamp",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "rawJson",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "preview",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "input",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "contentBlocks",
  "plural": true,
  "selections": [
    (v18/*: any*/),
    (v23/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "thinking",
          "storageKey": null
        },
        (v24/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "signature",
          "storageKey": null
        }
      ],
      "type": "ThinkingBlock",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "text",
          "storageKey": null
        }
      ],
      "type": "TextBlock",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v25/*: any*/),
        (v4/*: any*/),
        (v26/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "category",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "icon",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "displayName",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "color",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "ToolResultBlock",
          "kind": "LinkedField",
          "name": "result",
          "plural": false,
          "selections": [
            (v25/*: any*/),
            (v22/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "isError",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "isLong",
              "storageKey": null
            },
            (v24/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasImage",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "type": "ToolUseBlock",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "mediaType",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "dataUrl",
          "storageKey": null
        }
      ],
      "type": "ImageBlock",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sentimentScore",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sentimentLevel",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frustrationScore",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frustrationLevel",
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "signals",
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messageId",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "fileCount",
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "plugin",
  "storageKey": null
},
v36 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hook",
  "storageKey": null
},
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "directory",
  "storageKey": null
},
v38 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cached",
  "storageKey": null
},
v39 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "success",
  "storageKey": null
},
v40 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "durationMs",
  "storageKey": null
},
v41 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "exitCode",
  "storageKey": null
},
v42 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v43 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
},
v44 = [
  (v20/*: any*/),
  (v21/*: any*/),
  (v35/*: any*/),
  (v36/*: any*/),
  (v37/*: any*/),
  (v38/*: any*/),
  (v40/*: any*/),
  (v41/*: any*/),
  (v39/*: any*/),
  (v42/*: any*/),
  (v43/*: any*/)
],
v45 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hookType",
  "storageKey": null
},
v46 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "filePath",
  "storageKey": null
},
v47 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tool",
  "storageKey": null
},
v48 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "server",
  "storageKey": null
},
v49 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "prefixedName",
  "storageKey": null
},
v50 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "callId",
  "storageKey": null
},
v51 = [
  (v2/*: any*/),
  (v39/*: any*/),
  (v40/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "result",
    "storageKey": null
  },
  (v43/*: any*/)
],
v52 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v53 = {
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
v54 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalCount",
  "storageKey": null
},
v55 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hookName",
  "storageKey": null
},
v56 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "passed",
  "storageKey": null
},
v57 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "pluginName",
  "storageKey": null
},
v58 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "total",
  "storageKey": null
},
v59 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v60 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "activeForm",
  "storageKey": null
},
v61 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "taskId",
  "storageKey": null
},
v62 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v63 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "completedAt",
  "storageKey": null
},
v64 = [
  (v2/*: any*/),
  (v61/*: any*/),
  (v62/*: any*/),
  (v23/*: any*/),
  (v59/*: any*/),
  (v12/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/),
              (v13/*: any*/),
              (v14/*: any*/),
              (v15/*: any*/),
              (v16/*: any*/),
              (v17/*: any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SessionMessages_session"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SessionSidebar_session"
              }
            ],
            "type": "Session",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SessionDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v18/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/),
              (v13/*: any*/),
              (v14/*: any*/),
              (v15/*: any*/),
              (v16/*: any*/),
              (v17/*: any*/),
              {
                "alias": null,
                "args": (v19/*: any*/),
                "concreteType": "MessageConnection",
                "kind": "LinkedField",
                "name": "messages",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "MessageEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v18/*: any*/),
                          (v2/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "searchText",
                            "storageKey": null
                          },
                          {
                            "kind": "TypeDiscriminator",
                            "abstractKey": "__isMessage"
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v22/*: any*/),
                              (v27/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SentimentAnalysis",
                                "kind": "LinkedField",
                                "name": "sentimentAnalysis",
                                "plural": false,
                                "selections": [
                                  (v28/*: any*/),
                                  (v29/*: any*/),
                                  (v30/*: any*/),
                                  (v31/*: any*/),
                                  (v32/*: any*/),
                                  (v2/*: any*/)
                                ],
                                "storageKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "commandName",
                                    "storageKey": null
                                  }
                                ],
                                "type": "CommandUserMessage",
                                "abstractKey": null
                              }
                            ],
                            "type": "UserMessage",
                            "abstractKey": "__isUserMessage"
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v22/*: any*/),
                              (v27/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "isToolOnly",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "model",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "hasThinking",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "thinkingCount",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "hasToolUse",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "toolUseCount",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "inputTokens",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "outputTokens",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "cachedTokens",
                                "storageKey": null
                              }
                            ],
                            "type": "AssistantMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v22/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "isCompactSummary",
                                "storageKey": null
                              }
                            ],
                            "type": "SummaryMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v22/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "subtype",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "level",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "isMeta",
                                "storageKey": null
                              }
                            ],
                            "type": "SystemMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v33/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "isSnapshotUpdate",
                                "storageKey": null
                              },
                              (v34/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "snapshotTimestamp",
                                "storageKey": null
                              }
                            ],
                            "type": "FileHistorySnapshotMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v35/*: any*/),
                              (v36/*: any*/),
                              (v37/*: any*/),
                              (v38/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "hookRunId",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "HookResult",
                                "kind": "LinkedField",
                                "name": "result",
                                "plural": false,
                                "selections": [
                                  (v2/*: any*/),
                                  (v39/*: any*/),
                                  (v40/*: any*/),
                                  (v41/*: any*/),
                                  (v42/*: any*/),
                                  (v43/*: any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "HookRunMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v44/*: any*/),
                            "type": "HookResultMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v45/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "fingerprint",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "hooksCount",
                                "storageKey": null
                              }
                            ],
                            "type": "HookCheckStateMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v35/*: any*/),
                              (v46/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "reason",
                                "storageKey": null
                              },
                              (v39/*: any*/),
                              (v40/*: any*/)
                            ],
                            "type": "HookReferenceMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v44/*: any*/),
                            "type": "HookValidationMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v35/*: any*/),
                              (v36/*: any*/),
                              (v37/*: any*/),
                              (v34/*: any*/)
                            ],
                            "type": "HookValidationCacheMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v35/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "command",
                                "storageKey": null
                              },
                              (v40/*: any*/),
                              (v41/*: any*/),
                              (v39/*: any*/),
                              (v42/*: any*/)
                            ],
                            "type": "HookScriptMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v35/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "datetime",
                                "storageKey": null
                              },
                              (v40/*: any*/)
                            ],
                            "type": "HookDatetimeMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "recordedSessionId",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "changeToolName",
                                "storageKey": null
                              },
                              (v46/*: any*/)
                            ],
                            "type": "HookFileChangeMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "operation",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "queueSessionId",
                                "storageKey": null
                              }
                            ],
                            "type": "QueueOperationMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v47/*: any*/),
                              (v48/*: any*/),
                              (v49/*: any*/),
                              (v26/*: any*/),
                              (v50/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "McpToolResult",
                                "kind": "LinkedField",
                                "name": "result",
                                "plural": false,
                                "selections": (v51/*: any*/),
                                "storageKey": null
                              }
                            ],
                            "type": "McpToolCallMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v47/*: any*/),
                              (v48/*: any*/),
                              (v49/*: any*/),
                              (v40/*: any*/),
                              (v39/*: any*/),
                              (v42/*: any*/),
                              (v43/*: any*/)
                            ],
                            "type": "McpToolResultMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v47/*: any*/),
                              (v49/*: any*/),
                              (v26/*: any*/),
                              (v50/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "ExposedToolResult",
                                "kind": "LinkedField",
                                "name": "result",
                                "plural": false,
                                "selections": (v51/*: any*/),
                                "storageKey": null
                              }
                            ],
                            "type": "ExposedToolCallMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v47/*: any*/),
                              (v49/*: any*/),
                              (v40/*: any*/),
                              (v39/*: any*/),
                              (v42/*: any*/),
                              (v43/*: any*/)
                            ],
                            "type": "ExposedToolResultMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "question",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "route",
                                "storageKey": null
                              },
                              (v40/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "resultCount",
                                "storageKey": null
                              }
                            ],
                            "type": "MemoryQueryMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "domain",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "scope",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "paths",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "append",
                                "storageKey": null
                              }
                            ],
                            "type": "MemoryLearnMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v28/*: any*/),
                              (v29/*: any*/),
                              (v30/*: any*/),
                              (v31/*: any*/),
                              (v32/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "analyzedMessageId",
                                "storageKey": null
                              }
                            ],
                            "type": "SentimentAnalysisMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v20/*: any*/),
                              (v21/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "messageType",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "eventType",
                                "storageKey": null
                              }
                            ],
                            "type": "UnknownEventMessage",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      (v52/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v53/*: any*/),
                  (v54/*: any*/),
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
                "storageKey": "messages(first:50)"
              },
              {
                "alias": null,
                "args": (v19/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "SessionMessages_messages",
                "kind": "LinkedHandle",
                "name": "messages"
              },
              {
                "alias": null,
                "args": (v19/*: any*/),
                "concreteType": "HookExecutionConnection",
                "kind": "LinkedField",
                "name": "hookExecutions",
                "plural": false,
                "selections": [
                  (v54/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "HookExecutionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "HookExecution",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v2/*: any*/),
                          (v45/*: any*/),
                          (v55/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "hookSource",
                            "storageKey": null
                          },
                          (v37/*: any*/),
                          (v40/*: any*/),
                          (v56/*: any*/),
                          (v42/*: any*/),
                          (v43/*: any*/),
                          (v20/*: any*/),
                          (v18/*: any*/)
                        ],
                        "storageKey": null
                      },
                      (v52/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v53/*: any*/)
                ],
                "storageKey": "hookExecutions(first:50)"
              },
              {
                "alias": null,
                "args": (v19/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "SessionSidebar_hookExecutions",
                "kind": "LinkedHandle",
                "name": "hookExecutions"
              },
              {
                "alias": null,
                "args": (v19/*: any*/),
                "concreteType": "FileChangeConnection",
                "kind": "LinkedField",
                "name": "fileChanges",
                "plural": false,
                "selections": [
                  (v54/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "FileChangeEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "FileChange",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v2/*: any*/),
                          (v46/*: any*/),
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
                            "name": "toolName",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "recordedAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "isValidated",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "FileValidation",
                            "kind": "LinkedField",
                            "name": "validations",
                            "plural": true,
                            "selections": [
                              (v57/*: any*/),
                              (v55/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "validatedAt",
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "FileValidation",
                            "kind": "LinkedField",
                            "name": "missingValidations",
                            "plural": true,
                            "selections": [
                              (v57/*: any*/),
                              (v55/*: any*/)
                            ],
                            "storageKey": null
                          },
                          (v18/*: any*/)
                        ],
                        "storageKey": null
                      },
                      (v52/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v53/*: any*/)
                ],
                "storageKey": "fileChanges(first:50)"
              },
              {
                "alias": null,
                "args": (v19/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "SessionSidebar_fileChanges",
                "kind": "LinkedHandle",
                "name": "fileChanges"
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "fileChangeCount",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "HookStats",
                "kind": "LinkedField",
                "name": "hookStats",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "totalHooks",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "passedHooks",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "failedHooks",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "totalDurationMs",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "passRate",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "HookTypeStat",
                    "kind": "LinkedField",
                    "name": "byHookType",
                    "plural": true,
                    "selections": [
                      (v45/*: any*/),
                      (v58/*: any*/),
                      (v56/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "FrustrationSummary",
                "kind": "LinkedField",
                "name": "frustrationSummary",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "totalAnalyzed",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "moderateCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "highCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "overallLevel",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "averageScore",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "peakScore",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "topSignals",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "TodoConnection",
                "kind": "LinkedField",
                "name": "todos",
                "plural": false,
                "selections": [
                  (v54/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "TodoEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Todo",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v2/*: any*/),
                          (v22/*: any*/),
                          (v59/*: any*/),
                          (v60/*: any*/)
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
                "concreteType": "Todo",
                "kind": "LinkedField",
                "name": "currentTodo",
                "plural": false,
                "selections": [
                  (v22/*: any*/),
                  (v60/*: any*/),
                  (v59/*: any*/),
                  (v2/*: any*/)
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
                  (v58/*: any*/),
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
                "concreteType": "TaskConnection",
                "kind": "LinkedField",
                "name": "tasks",
                "plural": false,
                "selections": [
                  (v54/*: any*/),
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
                          (v61/*: any*/),
                          (v62/*: any*/),
                          (v23/*: any*/),
                          (v59/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "outcome",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "confidence",
                            "storageKey": null
                          },
                          (v12/*: any*/),
                          (v63/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "durationSeconds",
                            "storageKey": null
                          }
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
                "concreteType": "TaskConnection",
                "kind": "LinkedField",
                "name": "activeTasks",
                "plural": false,
                "selections": [
                  (v54/*: any*/),
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
                        "selections": (v64/*: any*/),
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
                "concreteType": "Task",
                "kind": "LinkedField",
                "name": "currentTask",
                "plural": false,
                "selections": (v64/*: any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "NativeTask",
                "kind": "LinkedField",
                "name": "nativeTasks",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v33/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "subject",
                    "storageKey": null
                  },
                  (v62/*: any*/),
                  (v59/*: any*/),
                  (v60/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "owner",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "blocks",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "blockedBy",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "createdAt",
                    "storageKey": null
                  },
                  (v13/*: any*/),
                  (v63/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Session",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8f00bd5589e67ef71a26acf7197f5ac5",
    "id": null,
    "metadata": {},
    "name": "SessionDetailPageQuery",
    "operationKind": "query",
    "text": "query SessionDetailPageQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Session {\n      id\n      sessionId\n      name\n      date\n      projectName\n      projectPath\n      projectId\n      worktreeName\n      summary\n      messageCount\n      startedAt\n      updatedAt\n      gitBranch\n      version\n      orgId\n      owner {\n        id\n        name\n        email\n        avatarUrl\n      }\n      ...SessionMessages_session\n      ...SessionSidebar_session\n    }\n    id\n  }\n}\n\nfragment AssistantMessageCard_message on AssistantMessage {\n  id\n  timestamp\n  rawJson\n  content\n  contentBlocks {\n    __typename\n    type\n    ... on ThinkingBlock {\n      thinking\n      preview\n      signature\n    }\n    ... on TextBlock {\n      text\n    }\n    ... on ToolUseBlock {\n      toolCallId\n      name\n      input\n      category\n      icon\n      displayName\n      color\n      result {\n        toolCallId\n        content\n        isError\n        isLong\n        preview\n        hasImage\n      }\n    }\n    ... on ImageBlock {\n      mediaType\n      dataUrl\n    }\n  }\n  isToolOnly\n  model\n  hasThinking\n  thinkingCount\n  hasToolUse\n  toolUseCount\n  inputTokens\n  outputTokens\n  cachedTokens\n}\n\nfragment ExposedToolCallMessageCard_message on ExposedToolCallMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  prefixedName\n  input\n  callId\n  result {\n    id\n    success\n    durationMs\n    result\n    error\n  }\n}\n\nfragment ExposedToolResultMessageCard_message on ExposedToolResultMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  prefixedName\n  durationMs\n  success\n  output\n  error\n}\n\nfragment FileHistorySnapshotMessageCard_message on FileHistorySnapshotMessage {\n  id\n  timestamp\n  rawJson\n  messageId\n  isSnapshotUpdate\n  fileCount\n  snapshotTimestamp\n}\n\nfragment HookCheckStateMessageCard_message on HookCheckStateMessage {\n  id\n  timestamp\n  rawJson\n  hookType\n  fingerprint\n  hooksCount\n}\n\nfragment HookDatetimeMessageCard_message on HookDatetimeMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  datetime\n  durationMs\n}\n\nfragment HookFileChangeMessageCard_message on HookFileChangeMessage {\n  id\n  timestamp\n  rawJson\n  recordedSessionId\n  changeToolName\n  filePath\n}\n\nfragment HookReferenceMessageCard_message on HookReferenceMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  filePath\n  reason\n  success\n  durationMs\n}\n\nfragment HookResultMessageCard_message on HookResultMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  cached\n  durationMs\n  exitCode\n  success\n  output\n  error\n}\n\nfragment HookRunMessageCard_message on HookRunMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  cached\n  hookRunId\n  result {\n    id\n    success\n    durationMs\n    exitCode\n    output\n    error\n  }\n}\n\nfragment HookScriptMessageCard_message on HookScriptMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  command\n  durationMs\n  exitCode\n  success\n  output\n}\n\nfragment HookValidationCacheMessageCard_message on HookValidationCacheMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  fileCount\n}\n\nfragment HookValidationMessageCard_message on HookValidationMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  cached\n  durationMs\n  exitCode\n  success\n  output\n  error\n}\n\nfragment McpToolCallMessageCard_message on McpToolCallMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  server\n  prefixedName\n  input\n  callId\n  result {\n    id\n    success\n    durationMs\n    result\n    error\n  }\n}\n\nfragment McpToolResultMessageCard_message on McpToolResultMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  server\n  prefixedName\n  durationMs\n  success\n  output\n  error\n}\n\nfragment MemoryLearnMessageCard_message on MemoryLearnMessage {\n  id\n  timestamp\n  rawJson\n  domain\n  scope\n  paths\n  append\n}\n\nfragment MemoryQueryMessageCard_message on MemoryQueryMessage {\n  id\n  timestamp\n  rawJson\n  question\n  route\n  durationMs\n  resultCount\n}\n\nfragment MessageCards_message on Message {\n  __isMessage: __typename\n  __typename\n  id\n  ...UserMessageCard_message\n  ...AssistantMessageCard_message\n  ...SummaryMessageCard_message\n  ...SystemMessageCard_message\n  ...FileHistorySnapshotMessageCard_message\n  ...HookRunMessageCard_message\n  ...HookResultMessageCard_message\n  ...HookCheckStateMessageCard_message\n  ...HookReferenceMessageCard_message\n  ...HookValidationMessageCard_message\n  ...HookValidationCacheMessageCard_message\n  ...HookScriptMessageCard_message\n  ...HookDatetimeMessageCard_message\n  ...HookFileChangeMessageCard_message\n  ...QueueOperationMessageCard_message\n  ...McpToolCallMessageCard_message\n  ...McpToolResultMessageCard_message\n  ...ExposedToolCallMessageCard_message\n  ...ExposedToolResultMessageCard_message\n  ...MemoryQueryMessageCard_message\n  ...MemoryLearnMessageCard_message\n  ...SentimentAnalysisMessageCard_message\n  ...UnknownEventMessageCard_message\n}\n\nfragment QueueOperationMessageCard_message on QueueOperationMessage {\n  id\n  timestamp\n  rawJson\n  operation\n  queueSessionId\n}\n\nfragment SentimentAnalysisMessageCard_message on SentimentAnalysisMessage {\n  id\n  timestamp\n  rawJson\n  sentimentScore\n  sentimentLevel\n  frustrationScore\n  frustrationLevel\n  signals\n  analyzedMessageId\n}\n\nfragment SessionMessages_session on Session {\n  messageCount\n  messages(first: 50) {\n    edges {\n      node {\n        __typename\n        id\n        searchText\n        ...MessageCards_message\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n  id\n}\n\nfragment SessionSidebar_fileChanges on Session {\n  fileChanges(first: 50) {\n    totalCount\n    edges {\n      node {\n        id\n        filePath\n        action\n        toolName\n        recordedAt\n        isValidated\n        validations {\n          pluginName\n          hookName\n          validatedAt\n        }\n        missingValidations {\n          pluginName\n          hookName\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  fileChangeCount\n  id\n}\n\nfragment SessionSidebar_hookExecutions on Session {\n  hookExecutions(first: 50) {\n    totalCount\n    edges {\n      node {\n        id\n        hookType\n        hookName\n        hookSource\n        directory\n        durationMs\n        passed\n        output\n        error\n        timestamp\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  id\n}\n\nfragment SessionSidebar_session on Session {\n  ...SessionSidebar_hookExecutions\n  ...SessionSidebar_fileChanges\n  hookStats {\n    totalHooks\n    passedHooks\n    failedHooks\n    totalDurationMs\n    passRate\n    byHookType {\n      hookType\n      total\n      passed\n    }\n  }\n  frustrationSummary {\n    totalAnalyzed\n    moderateCount\n    highCount\n    overallLevel\n    averageScore\n    peakScore\n    topSignals\n  }\n  todos {\n    totalCount\n    edges {\n      node {\n        id\n        content\n        status\n        activeForm\n      }\n    }\n  }\n  currentTodo {\n    content\n    activeForm\n    status\n    id\n  }\n  todoCounts {\n    total\n    pending\n    inProgress\n    completed\n  }\n  tasks {\n    totalCount\n    edges {\n      node {\n        id\n        taskId\n        description\n        type\n        status\n        outcome\n        confidence\n        startedAt\n        completedAt\n        durationSeconds\n      }\n    }\n  }\n  activeTasks {\n    totalCount\n    edges {\n      node {\n        id\n        taskId\n        description\n        type\n        status\n        startedAt\n      }\n    }\n  }\n  currentTask {\n    id\n    taskId\n    description\n    type\n    status\n    startedAt\n  }\n  nativeTasks {\n    id\n    sessionId\n    messageId\n    subject\n    description\n    status\n    activeForm\n    owner\n    blocks\n    blockedBy\n    createdAt\n    updatedAt\n    completedAt\n  }\n}\n\nfragment SummaryMessageCard_message on SummaryMessage {\n  id\n  timestamp\n  rawJson\n  content\n  isCompactSummary\n}\n\nfragment SystemMessageCard_message on SystemMessage {\n  id\n  timestamp\n  rawJson\n  content\n  subtype\n  level\n  isMeta\n}\n\nfragment UnknownEventMessageCard_message on UnknownEventMessage {\n  id\n  timestamp\n  rawJson\n  messageType\n  eventType\n}\n\nfragment UserMessageCard_message on UserMessage {\n  __isUserMessage: __typename\n  __typename\n  id\n  timestamp\n  rawJson\n  content\n  contentBlocks {\n    __typename\n    type\n    ... on ThinkingBlock {\n      thinking\n      preview\n      signature\n    }\n    ... on TextBlock {\n      text\n    }\n    ... on ToolUseBlock {\n      toolCallId\n      name\n      input\n      category\n      icon\n      displayName\n      color\n      result {\n        toolCallId\n        content\n        isError\n        isLong\n        preview\n        hasImage\n      }\n    }\n    ... on ImageBlock {\n      mediaType\n      dataUrl\n    }\n  }\n  sentimentAnalysis {\n    sentimentScore\n    sentimentLevel\n    frustrationScore\n    frustrationLevel\n    signals\n    id\n  }\n  ... on CommandUserMessage {\n    commandName\n  }\n}\n"
  }
};
})();

(node as any).hash = "643b1f8db5de1259e0dc246a59dce713";

export default node;
