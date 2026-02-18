/**
 * @generated SignedSource<<26ae4351261f4e6864b9b5085f394ce6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionMessagesSubscription$variables = {
  connections: ReadonlyArray<string>;
  sessionId: string;
};
export type SessionMessagesSubscription$data = {
  readonly sessionMessageAdded: {
    readonly messageIndex: number;
    readonly newMessageEdge: {
      readonly cursor: string;
      readonly node: {
        readonly __typename: string;
        readonly id: string;
        readonly parentId: string | null | undefined;
        readonly searchText: string | null | undefined;
        readonly " $fragmentSpreads": FragmentRefs<"MessageCards_message">;
      };
    } | null | undefined;
    readonly sessionId: string;
  };
};
export type SessionMessagesSubscription = {
  response: SessionMessagesSubscription$data;
  variables: SessionMessagesSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sessionId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "sessionId",
    "variableName": "sessionId"
  }
],
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
  "name": "messageIndex",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "searchText",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "timestamp",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "rawJson",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "preview",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "input",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "contentBlocks",
  "plural": true,
  "selections": [
    (v6/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "type",
      "storageKey": null
    },
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
        (v13/*: any*/),
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
        (v14/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        },
        (v15/*: any*/),
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
            (v14/*: any*/),
            (v12/*: any*/),
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
            (v13/*: any*/),
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
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sentimentScore",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sentimentLevel",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frustrationScore",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frustrationLevel",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "signals",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "fileCount",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "plugin",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hook",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "directory",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cached",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "success",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "durationMs",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "exitCode",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
},
v32 = [
  (v10/*: any*/),
  (v11/*: any*/),
  (v23/*: any*/),
  (v24/*: any*/),
  (v25/*: any*/),
  (v26/*: any*/),
  (v28/*: any*/),
  (v29/*: any*/),
  (v27/*: any*/),
  (v30/*: any*/),
  (v31/*: any*/)
],
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "filePath",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tool",
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "server",
  "storageKey": null
},
v36 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "prefixedName",
  "storageKey": null
},
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "callId",
  "storageKey": null
},
v38 = [
  (v5/*: any*/),
  (v27/*: any*/),
  (v28/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "result",
    "storageKey": null
  },
  (v31/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionMessagesSubscription",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "SessionMessageAddedPayload",
        "kind": "LinkedField",
        "name": "sessionMessageAdded",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "MessageEdge",
            "kind": "LinkedField",
            "name": "newMessageEdge",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "MessageCards_message"
                  }
                ],
                "storageKey": null
              },
              (v9/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "SubscriptionRoot",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "SessionMessagesSubscription",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "SessionMessageAddedPayload",
        "kind": "LinkedField",
        "name": "sessionMessageAdded",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "MessageEdge",
            "kind": "LinkedField",
            "name": "newMessageEdge",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  {
                    "kind": "TypeDiscriminator",
                    "abstractKey": "__isMessage"
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v12/*: any*/),
                      (v16/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SentimentAnalysis",
                        "kind": "LinkedField",
                        "name": "sentimentAnalysis",
                        "plural": false,
                        "selections": [
                          (v17/*: any*/),
                          (v18/*: any*/),
                          (v19/*: any*/),
                          (v20/*: any*/),
                          (v21/*: any*/),
                          (v5/*: any*/)
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
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v12/*: any*/),
                      (v16/*: any*/),
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
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v12/*: any*/),
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
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v12/*: any*/),
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
                      (v10/*: any*/),
                      (v11/*: any*/),
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
                      (v22/*: any*/),
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
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v23/*: any*/),
                      (v24/*: any*/),
                      (v25/*: any*/),
                      (v26/*: any*/),
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
                          (v5/*: any*/),
                          (v27/*: any*/),
                          (v28/*: any*/),
                          (v29/*: any*/),
                          (v30/*: any*/),
                          (v31/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "HookRunMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": (v32/*: any*/),
                    "type": "HookResultMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "hookType",
                        "storageKey": null
                      },
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
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v23/*: any*/),
                      (v33/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "reason",
                        "storageKey": null
                      },
                      (v27/*: any*/),
                      (v28/*: any*/)
                    ],
                    "type": "HookReferenceMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": (v32/*: any*/),
                    "type": "HookValidationMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v23/*: any*/),
                      (v24/*: any*/),
                      (v25/*: any*/),
                      (v22/*: any*/)
                    ],
                    "type": "HookValidationCacheMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v23/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "command",
                        "storageKey": null
                      },
                      (v28/*: any*/),
                      (v29/*: any*/),
                      (v27/*: any*/),
                      (v30/*: any*/)
                    ],
                    "type": "HookScriptMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v23/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "datetime",
                        "storageKey": null
                      },
                      (v28/*: any*/)
                    ],
                    "type": "HookDatetimeMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
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
                      (v33/*: any*/)
                    ],
                    "type": "HookFileChangeMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
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
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v34/*: any*/),
                      (v35/*: any*/),
                      (v36/*: any*/),
                      (v15/*: any*/),
                      (v37/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "McpToolResult",
                        "kind": "LinkedField",
                        "name": "result",
                        "plural": false,
                        "selections": (v38/*: any*/),
                        "storageKey": null
                      }
                    ],
                    "type": "McpToolCallMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v34/*: any*/),
                      (v35/*: any*/),
                      (v36/*: any*/),
                      (v28/*: any*/),
                      (v27/*: any*/),
                      (v30/*: any*/),
                      (v31/*: any*/)
                    ],
                    "type": "McpToolResultMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v34/*: any*/),
                      (v36/*: any*/),
                      (v15/*: any*/),
                      (v37/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExposedToolResult",
                        "kind": "LinkedField",
                        "name": "result",
                        "plural": false,
                        "selections": (v38/*: any*/),
                        "storageKey": null
                      }
                    ],
                    "type": "ExposedToolCallMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v34/*: any*/),
                      (v36/*: any*/),
                      (v28/*: any*/),
                      (v27/*: any*/),
                      (v30/*: any*/),
                      (v31/*: any*/)
                    ],
                    "type": "ExposedToolResultMessage",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
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
                      (v28/*: any*/),
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
                      (v10/*: any*/),
                      (v11/*: any*/),
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
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v17/*: any*/),
                      (v18/*: any*/),
                      (v19/*: any*/),
                      (v20/*: any*/),
                      (v21/*: any*/),
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
                      (v10/*: any*/),
                      (v11/*: any*/),
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
              (v9/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependEdge",
            "key": "",
            "kind": "LinkedHandle",
            "name": "newMessageEdge",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "833a4ed1e3f791e05b75929bc62d759a",
    "id": null,
    "metadata": {},
    "name": "SessionMessagesSubscription",
    "operationKind": "subscription",
    "text": "subscription SessionMessagesSubscription(\n  $sessionId: ID!\n) {\n  sessionMessageAdded(sessionId: $sessionId) {\n    sessionId\n    messageIndex\n    newMessageEdge {\n      node {\n        id\n        __typename\n        parentId\n        searchText\n        ...MessageCards_message\n      }\n      cursor\n    }\n  }\n}\n\nfragment AssistantMessageCard_message on AssistantMessage {\n  id\n  timestamp\n  rawJson\n  content\n  contentBlocks {\n    __typename\n    type\n    ... on ThinkingBlock {\n      thinking\n      preview\n      signature\n    }\n    ... on TextBlock {\n      text\n    }\n    ... on ToolUseBlock {\n      toolCallId\n      name\n      input\n      category\n      icon\n      displayName\n      color\n      result {\n        toolCallId\n        content\n        isError\n        isLong\n        preview\n        hasImage\n      }\n    }\n    ... on ImageBlock {\n      mediaType\n      dataUrl\n    }\n  }\n  isToolOnly\n  model\n  hasThinking\n  thinkingCount\n  hasToolUse\n  toolUseCount\n  inputTokens\n  outputTokens\n  cachedTokens\n}\n\nfragment ExposedToolCallMessageCard_message on ExposedToolCallMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  prefixedName\n  input\n  callId\n  result {\n    id\n    success\n    durationMs\n    result\n    error\n  }\n}\n\nfragment ExposedToolResultMessageCard_message on ExposedToolResultMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  prefixedName\n  durationMs\n  success\n  output\n  error\n}\n\nfragment FileHistorySnapshotMessageCard_message on FileHistorySnapshotMessage {\n  id\n  timestamp\n  rawJson\n  messageId\n  isSnapshotUpdate\n  fileCount\n  snapshotTimestamp\n}\n\nfragment HookCheckStateMessageCard_message on HookCheckStateMessage {\n  id\n  timestamp\n  rawJson\n  hookType\n  fingerprint\n  hooksCount\n}\n\nfragment HookDatetimeMessageCard_message on HookDatetimeMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  datetime\n  durationMs\n}\n\nfragment HookFileChangeMessageCard_message on HookFileChangeMessage {\n  id\n  timestamp\n  rawJson\n  recordedSessionId\n  changeToolName\n  filePath\n}\n\nfragment HookReferenceMessageCard_message on HookReferenceMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  filePath\n  reason\n  success\n  durationMs\n}\n\nfragment HookResultMessageCard_message on HookResultMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  cached\n  durationMs\n  exitCode\n  success\n  output\n  error\n}\n\nfragment HookRunMessageCard_message on HookRunMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  cached\n  hookRunId\n  result {\n    id\n    success\n    durationMs\n    exitCode\n    output\n    error\n  }\n}\n\nfragment HookScriptMessageCard_message on HookScriptMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  command\n  durationMs\n  exitCode\n  success\n  output\n}\n\nfragment HookValidationCacheMessageCard_message on HookValidationCacheMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  fileCount\n}\n\nfragment HookValidationMessageCard_message on HookValidationMessage {\n  id\n  timestamp\n  rawJson\n  plugin\n  hook\n  directory\n  cached\n  durationMs\n  exitCode\n  success\n  output\n  error\n}\n\nfragment McpToolCallMessageCard_message on McpToolCallMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  server\n  prefixedName\n  input\n  callId\n  result {\n    id\n    success\n    durationMs\n    result\n    error\n  }\n}\n\nfragment McpToolResultMessageCard_message on McpToolResultMessage {\n  id\n  timestamp\n  rawJson\n  tool\n  server\n  prefixedName\n  durationMs\n  success\n  output\n  error\n}\n\nfragment MemoryLearnMessageCard_message on MemoryLearnMessage {\n  id\n  timestamp\n  rawJson\n  domain\n  scope\n  paths\n  append\n}\n\nfragment MemoryQueryMessageCard_message on MemoryQueryMessage {\n  id\n  timestamp\n  rawJson\n  question\n  route\n  durationMs\n  resultCount\n}\n\nfragment MessageCards_message on Message {\n  __isMessage: __typename\n  __typename\n  id\n  parentId\n  ...UserMessageCard_message\n  ...AssistantMessageCard_message\n  ...SummaryMessageCard_message\n  ...SystemMessageCard_message\n  ...FileHistorySnapshotMessageCard_message\n  ...HookRunMessageCard_message\n  ...HookResultMessageCard_message\n  ...HookCheckStateMessageCard_message\n  ...HookReferenceMessageCard_message\n  ...HookValidationMessageCard_message\n  ...HookValidationCacheMessageCard_message\n  ...HookScriptMessageCard_message\n  ...HookDatetimeMessageCard_message\n  ...HookFileChangeMessageCard_message\n  ...QueueOperationMessageCard_message\n  ...McpToolCallMessageCard_message\n  ...McpToolResultMessageCard_message\n  ...ExposedToolCallMessageCard_message\n  ...ExposedToolResultMessageCard_message\n  ...MemoryQueryMessageCard_message\n  ...MemoryLearnMessageCard_message\n  ...SentimentAnalysisMessageCard_message\n  ...UnknownEventMessageCard_message\n}\n\nfragment QueueOperationMessageCard_message on QueueOperationMessage {\n  id\n  timestamp\n  rawJson\n  operation\n  queueSessionId\n}\n\nfragment SentimentAnalysisMessageCard_message on SentimentAnalysisMessage {\n  id\n  timestamp\n  rawJson\n  sentimentScore\n  sentimentLevel\n  frustrationScore\n  frustrationLevel\n  signals\n  analyzedMessageId\n}\n\nfragment SummaryMessageCard_message on SummaryMessage {\n  id\n  timestamp\n  rawJson\n  content\n  isCompactSummary\n}\n\nfragment SystemMessageCard_message on SystemMessage {\n  id\n  timestamp\n  rawJson\n  content\n  subtype\n  level\n  isMeta\n}\n\nfragment UnknownEventMessageCard_message on UnknownEventMessage {\n  id\n  timestamp\n  rawJson\n  messageType\n  eventType\n}\n\nfragment UserMessageCard_message on UserMessage {\n  __isUserMessage: __typename\n  __typename\n  id\n  timestamp\n  rawJson\n  content\n  contentBlocks {\n    __typename\n    type\n    ... on ThinkingBlock {\n      thinking\n      preview\n      signature\n    }\n    ... on TextBlock {\n      text\n    }\n    ... on ToolUseBlock {\n      toolCallId\n      name\n      input\n      category\n      icon\n      displayName\n      color\n      result {\n        toolCallId\n        content\n        isError\n        isLong\n        preview\n        hasImage\n      }\n    }\n    ... on ImageBlock {\n      mediaType\n      dataUrl\n    }\n  }\n  sentimentAnalysis {\n    sentimentScore\n    sentimentLevel\n    frustrationScore\n    frustrationLevel\n    signals\n    id\n  }\n  ... on CommandUserMessage {\n    commandName\n  }\n}\n"
  }
};
})();

(node as any).hash = "0a11d5ba7d1b6a6d0225a03b42550740";

export default node;
