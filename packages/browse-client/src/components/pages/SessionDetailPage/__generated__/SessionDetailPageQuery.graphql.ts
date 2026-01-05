/**
 * @generated SignedSource<<984819354698e9c93606374384c26654>>
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
    readonly projectId?: string | null | undefined;
    readonly projectName?: string | null | undefined;
    readonly projectPath?: string | null | undefined;
    readonly sessionId?: string | null | undefined;
    readonly startedAt?: any | null | undefined;
    readonly summary?: string | null | undefined;
    readonly updatedAt?: any | null | undefined;
    readonly version?: string | null | undefined;
    readonly worktreeName?: string | null | undefined;
    readonly " $fragmentSpreads": FragmentRefs<"SessionExpensiveFields_session" | "SessionMessages_session">;
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
  "name": "date",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectName",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectPath",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectId",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "worktreeName",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "summary",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messageCount",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "gitBranch",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "version",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v16 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "timestamp",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "rawJson",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "preview",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "input",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "contentBlocks",
  "plural": true,
  "selections": [
    (v15/*: any*/),
    (v20/*: any*/),
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
        (v21/*: any*/),
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
        (v22/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        },
        (v23/*: any*/),
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
        }
      ],
      "type": "ToolUseBlock",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v22/*: any*/),
        (v19/*: any*/),
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
        (v21/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "hasImage",
          "storageKey": null
        }
      ],
      "type": "ToolResultBlock",
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
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isMeta",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sentimentScore",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sentimentLevel",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frustrationScore",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frustrationLevel",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "signals",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "fileCount",
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "plugin",
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hook",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "directory",
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cached",
  "storageKey": null
},
v36 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "durationMs",
  "storageKey": null
},
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "exitCode",
  "storageKey": null
},
v38 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "success",
  "storageKey": null
},
v39 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v40 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
},
v41 = [
  (v17/*: any*/),
  (v18/*: any*/),
  (v32/*: any*/),
  (v33/*: any*/),
  (v34/*: any*/),
  (v35/*: any*/),
  (v36/*: any*/),
  (v37/*: any*/),
  (v38/*: any*/),
  (v39/*: any*/),
  (v40/*: any*/)
],
v42 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "filePath",
  "storageKey": null
},
v43 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tool",
  "storageKey": null
},
v44 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "server",
  "storageKey": null
},
v45 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "prefixedName",
  "storageKey": null
},
v46 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "callId",
  "storageKey": null
},
v47 = [
  (v2/*: any*/),
  (v38/*: any*/),
  (v36/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "result",
    "storageKey": null
  },
  (v40/*: any*/)
],
v48 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hookType",
  "storageKey": null
},
v49 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hookName",
  "storageKey": null
},
v50 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "passed",
  "storageKey": null
},
v51 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "total",
  "storageKey": null
},
v52 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v53 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "activeForm",
  "storageKey": null
},
v54 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "taskId",
  "storageKey": null
},
v55 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v56 = [
  (v2/*: any*/),
  (v54/*: any*/),
  (v55/*: any*/),
  (v20/*: any*/),
  (v52/*: any*/),
  (v11/*: any*/)
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
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SessionMessages_session"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SessionExpensiveFields_session"
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
          (v15/*: any*/),
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
              {
                "alias": null,
                "args": (v16/*: any*/),
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
                          (v15/*: any*/),
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
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v19/*: any*/),
                              (v24/*: any*/),
                              (v25/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "isInterrupt",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "isCommand",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "commandName",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SentimentAnalysis",
                                "kind": "LinkedField",
                                "name": "sentimentAnalysis",
                                "plural": false,
                                "selections": [
                                  (v26/*: any*/),
                                  (v27/*: any*/),
                                  (v28/*: any*/),
                                  (v29/*: any*/),
                                  (v30/*: any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "UserMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v19/*: any*/),
                              (v24/*: any*/),
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
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v19/*: any*/),
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
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v19/*: any*/),
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
                              (v25/*: any*/)
                            ],
                            "type": "SystemMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "messageId",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "isSnapshotUpdate",
                                "storageKey": null
                              },
                              (v31/*: any*/),
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
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v32/*: any*/),
                              (v33/*: any*/),
                              (v34/*: any*/),
                              (v35/*: any*/)
                            ],
                            "type": "HookRunMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v41/*: any*/),
                            "type": "HookResultMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v32/*: any*/),
                              (v42/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "reason",
                                "storageKey": null
                              },
                              (v38/*: any*/),
                              (v36/*: any*/)
                            ],
                            "type": "HookReferenceMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v41/*: any*/),
                            "type": "HookValidationMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v32/*: any*/),
                              (v33/*: any*/),
                              (v34/*: any*/),
                              (v31/*: any*/)
                            ],
                            "type": "HookValidationCacheMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v32/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "command",
                                "storageKey": null
                              },
                              (v36/*: any*/),
                              (v37/*: any*/),
                              (v38/*: any*/),
                              (v39/*: any*/)
                            ],
                            "type": "HookScriptMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v32/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "datetime",
                                "storageKey": null
                              },
                              (v36/*: any*/)
                            ],
                            "type": "HookDatetimeMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
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
                              (v42/*: any*/)
                            ],
                            "type": "HookFileChangeMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
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
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v43/*: any*/),
                              (v44/*: any*/),
                              (v45/*: any*/),
                              (v23/*: any*/),
                              (v46/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "McpToolResult",
                                "kind": "LinkedField",
                                "name": "result",
                                "plural": false,
                                "selections": (v47/*: any*/),
                                "storageKey": null
                              }
                            ],
                            "type": "McpToolCallMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v43/*: any*/),
                              (v44/*: any*/),
                              (v45/*: any*/),
                              (v36/*: any*/),
                              (v38/*: any*/),
                              (v39/*: any*/),
                              (v40/*: any*/)
                            ],
                            "type": "McpToolResultMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v43/*: any*/),
                              (v45/*: any*/),
                              (v23/*: any*/),
                              (v46/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "ExposedToolResult",
                                "kind": "LinkedField",
                                "name": "result",
                                "plural": false,
                                "selections": (v47/*: any*/),
                                "storageKey": null
                              }
                            ],
                            "type": "ExposedToolCallMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v43/*: any*/),
                              (v45/*: any*/),
                              (v36/*: any*/),
                              (v38/*: any*/),
                              (v39/*: any*/),
                              (v40/*: any*/)
                            ],
                            "type": "ExposedToolResultMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v17/*: any*/),
                              (v18/*: any*/),
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
                              (v36/*: any*/),
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
                              (v17/*: any*/),
                              (v18/*: any*/),
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
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v26/*: any*/),
                              (v27/*: any*/),
                              (v28/*: any*/),
                              (v29/*: any*/),
                              (v30/*: any*/),
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
                              (v17/*: any*/),
                              (v18/*: any*/),
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
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "totalCount",
                    "storageKey": null
                  },
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
                "args": (v16/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "SessionMessages_messages",
                "kind": "LinkedHandle",
                "name": "messages"
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "Checkpoint",
                "kind": "LinkedField",
                "name": "checkpoints",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "checkpointId",
                    "storageKey": null
                  },
                  (v20/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "createdAt",
                    "storageKey": null
                  },
                  (v31/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "patternCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "patterns",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "HookExecution",
                "kind": "LinkedField",
                "name": "hookExecutions",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v48/*: any*/),
                  (v49/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "hookSource",
                    "storageKey": null
                  },
                  (v36/*: any*/),
                  (v50/*: any*/),
                  (v39/*: any*/),
                  (v40/*: any*/),
                  (v17/*: any*/)
                ],
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
                      (v48/*: any*/),
                      (v51/*: any*/),
                      (v50/*: any*/)
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
                "name": "todos",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v19/*: any*/),
                  (v52/*: any*/),
                  (v53/*: any*/)
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
                  (v19/*: any*/),
                  (v53/*: any*/),
                  (v52/*: any*/),
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
                  (v51/*: any*/),
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
                "concreteType": "Task",
                "kind": "LinkedField",
                "name": "tasks",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v54/*: any*/),
                  (v55/*: any*/),
                  (v20/*: any*/),
                  (v52/*: any*/),
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
                  (v11/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "completedAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "durationSeconds",
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
                "name": "activeTasks",
                "plural": true,
                "selections": (v56/*: any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "Task",
                "kind": "LinkedField",
                "name": "currentTask",
                "plural": false,
                "selections": (v56/*: any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "FileChange",
                "kind": "LinkedField",
                "name": "fileChanges",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v42/*: any*/),
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
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "pluginName",
                        "storageKey": null
                      },
                      (v49/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "validatedAt",
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
                "kind": "ScalarField",
                "name": "fileChangeCount",
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
    "cacheID": "33f1581e97d3f3a16b364026bf189169",
    "id": null,
    "metadata": {},
    "name": "SessionDetailPageQuery",
    "operationKind": "query",
    "text": "query SessionDetailPageQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Session {\n      id\n      sessionId\n      date\n      projectName\n      projectPath\n      projectId\n      worktreeName\n      summary\n      messageCount\n      startedAt\n      updatedAt\n      gitBranch\n      version\n      ...SessionMessages_session\n      ...SessionExpensiveFields_session\n    }\n    id\n  }\n}\n\nfragment AssistantMessageCard_message on AssistantMessage {\n  id\n  timestamp\n  rawJson\n  content\n  contentBlocks {\n    __typename\n    type\n    ... on ThinkingBlock {\n      thinking\n      preview\n      signature\n    }\n    ... on TextBlock {\n      text\n    }\n    ... on ToolUseBlock {\n      toolCallId\n      name\n      input\n      category\n      icon\n      displayName\n      color\n    }\n    ... on ToolResultBlock {\n      toolCallId\n      content\n      isError\n      isLong\n      preview\n      hasImage\n    }\n    ... on ImageBlock {\n      mediaType\n      dataUrl\n    }\n  }\n  isToolOnly\n  model\n  hasThinking\n  thinkingCount\n  hasToolUse\n  toolUseCount\n  inputTokens\n  outputTokens\n  cachedTokens\n}\n\nfragment ExposedToolCallMessageCard_message on ExposedToolCallMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  prefixedName\n  input\n  callId\n  result {\n    id\n    success\n    durationMs\n    result\n    error\n  }\n}\n\nfragment ExposedToolResultMessageCard_message on ExposedToolResultMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  prefixedName\n  durationMs\n  success\n  output\n  error\n}\n\nfragment FileHistorySnapshotMessageCard_message on FileHistorySnapshotMessage {\n  id\n  timestamp\n  rawJson\n  messageId\n  isSnapshotUpdate\n  fileCount\n  snapshotTimestamp\n}\n\nfragment HookDatetimeMessageCard_message on HookDatetimeMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  datetime\n  durationMs\n}\n\nfragment HookFileChangeMessageCard_message on HookFileChangeMessage {\n  id\n  timestamp\n  rawJson\n  recordedSessionId\n  changeToolName\n  filePath\n}\n\nfragment HookReferenceMessageCard_message on HookReferenceMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  filePath\n  reason\n  success\n  durationMs\n}\n\nfragment HookResultMessageCard_message on HookResultMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  cached\n  durationMs\n  exitCode\n  success\n  output\n  error\n}\n\nfragment HookRunMessageCard_message on HookRunMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  cached\n}\n\nfragment HookScriptMessageCard_message on HookScriptMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  command\n  durationMs\n  exitCode\n  success\n  output\n}\n\nfragment HookValidationCacheMessageCard_message on HookValidationCacheMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  fileCount\n}\n\nfragment HookValidationMessageCard_message on HookValidationMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  cached\n  durationMs\n  exitCode\n  success\n  output\n  error\n}\n\nfragment McpToolCallMessageCard_message on McpToolCallMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  server\n  prefixedName\n  input\n  callId\n  result {\n    id\n    success\n    durationMs\n    result\n    error\n  }\n}\n\nfragment McpToolResultMessageCard_message on McpToolResultMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  server\n  prefixedName\n  durationMs\n  success\n  output\n  error\n}\n\nfragment MemoryLearnMessageCard_message on MemoryLearnMessage {\n  id\n  timestamp\n  rawJson\n  domain\n  scope\n  paths\n  append\n}\n\nfragment MemoryQueryMessageCard_message on MemoryQueryMessage {\n  id\n  timestamp\n  rawJson\n  question\n  route\n  durationMs\n  resultCount\n}\n\nfragment MessageCards_message on Message {\n  __isMessage: __typename\n  __typename\n  id\n  ...UserMessageCard_message\n  ...AssistantMessageCard_message\n  ...SummaryMessageCard_message\n  ...SystemMessageCard_message\n  ...FileHistorySnapshotMessageCard_message\n  ...HookRunMessageCard_message\n  ...HookResultMessageCard_message\n  ...HookReferenceMessageCard_message\n  ...HookValidationMessageCard_message\n  ...HookValidationCacheMessageCard_message\n  ...HookScriptMessageCard_message\n  ...HookDatetimeMessageCard_message\n  ...HookFileChangeMessageCard_message\n  ...QueueOperationMessageCard_message\n  ...McpToolCallMessageCard_message\n  ...McpToolResultMessageCard_message\n  ...ExposedToolCallMessageCard_message\n  ...ExposedToolResultMessageCard_message\n  ...MemoryQueryMessageCard_message\n  ...MemoryLearnMessageCard_message\n  ...SentimentAnalysisMessageCard_message\n  ...UnknownEventMessageCard_message\n}\n\nfragment QueueOperationMessageCard_message on QueueOperationMessage {\n  id\n  timestamp\n  rawJson\n  operation\n  queueSessionId\n}\n\nfragment SentimentAnalysisMessageCard_message on SentimentAnalysisMessage {\n  id\n  timestamp\n  rawJson\n  sentimentScore\n  sentimentLevel\n  frustrationScore\n  frustrationLevel\n  signals\n  analyzedMessageId\n}\n\nfragment SessionExpensiveFields_session on Session {\n  checkpoints {\n    id\n    checkpointId\n    type\n    createdAt\n    fileCount\n    patternCount\n    patterns\n  }\n  hookExecutions {\n    id\n    hookType\n    hookName\n    hookSource\n    durationMs\n    passed\n    output\n    error\n    timestamp\n  }\n  hookStats {\n    totalHooks\n    passedHooks\n    failedHooks\n    totalDurationMs\n    passRate\n    byHookType {\n      hookType\n      total\n      passed\n    }\n  }\n  todos {\n    id\n    content\n    status\n    activeForm\n  }\n  currentTodo {\n    content\n    activeForm\n    status\n    id\n  }\n  todoCounts {\n    total\n    pending\n    inProgress\n    completed\n  }\n  tasks {\n    id\n    taskId\n    description\n    type\n    status\n    outcome\n    confidence\n    startedAt\n    completedAt\n    durationSeconds\n  }\n  activeTasks {\n    id\n    taskId\n    description\n    type\n    status\n    startedAt\n  }\n  currentTask {\n    id\n    taskId\n    description\n    type\n    status\n    startedAt\n  }\n  fileChanges {\n    id\n    filePath\n    action\n    toolName\n    recordedAt\n    isValidated\n    validations {\n      pluginName\n      hookName\n      validatedAt\n    }\n  }\n  fileChangeCount\n}\n\nfragment SessionMessages_session on Session {\n  messageCount\n  messages(first: 50) {\n    edges {\n      node {\n        __typename\n        id\n        searchText\n        ...MessageCards_message\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n  id\n}\n\nfragment SummaryMessageCard_message on SummaryMessage {\n  id\n  timestamp\n  rawJson\n  content\n  isCompactSummary\n}\n\nfragment SystemMessageCard_message on SystemMessage {\n  id\n  timestamp\n  rawJson\n  content\n  subtype\n  level\n  isMeta\n}\n\nfragment UnknownEventMessageCard_message on UnknownEventMessage {\n  id\n  timestamp\n  rawJson\n  messageType\n  eventType\n}\n\nfragment UserMessageCard_message on UserMessage {\n  id\n  timestamp\n  rawJson\n  content\n  contentBlocks {\n    __typename\n    type\n    ... on ThinkingBlock {\n      thinking\n      preview\n      signature\n    }\n    ... on TextBlock {\n      text\n    }\n    ... on ToolUseBlock {\n      toolCallId\n      name\n      input\n      category\n      icon\n      displayName\n      color\n    }\n    ... on ToolResultBlock {\n      toolCallId\n      content\n      isError\n      isLong\n      preview\n      hasImage\n    }\n    ... on ImageBlock {\n      mediaType\n      dataUrl\n    }\n  }\n  isMeta\n  isInterrupt\n  isCommand\n  commandName\n  sentimentAnalysis {\n    sentimentScore\n    sentimentLevel\n    frustrationScore\n    frustrationLevel\n    signals\n  }\n}\n"
  }
};
})();

(node as any).hash = "173fc07561345ff6ffb4c6e5327aff6b";

export default node;
