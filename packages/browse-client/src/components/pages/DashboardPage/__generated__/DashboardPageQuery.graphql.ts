/**
 * @generated SignedSource<<9739b977f5d0c53e40e74e3eb863efee>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DashboardPageQuery$variables = {
  projectId?: string | null | undefined;
};
export type DashboardPageQuery$data = {
  readonly metrics: {
    readonly averageConfidence: number | null | undefined;
    readonly calibrationScore: number | null | undefined;
    readonly completedTasks: number | null | undefined;
    readonly significantFrustrationRate: number | null | undefined;
    readonly significantFrustrations: number | null | undefined;
    readonly successRate: number | null | undefined;
    readonly totalTasks: number | null | undefined;
  } | null | undefined;
  readonly pluginCategories: ReadonlyArray<{
    readonly category: string | null | undefined;
    readonly count: number | null | undefined;
  }> | null | undefined;
  readonly pluginStats: {
    readonly enabledPlugins: number | null | undefined;
    readonly localPlugins: number | null | undefined;
    readonly projectPlugins: number | null | undefined;
    readonly totalPlugins: number | null | undefined;
    readonly userPlugins: number | null | undefined;
  } | null | undefined;
  readonly projects: ReadonlyArray<{
    readonly id: string | null | undefined;
  }> | null | undefined;
  readonly sessions: {
    readonly __id: string;
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"SessionListItem_session">;
      } | null | undefined;
    }> | null | undefined;
  } | null | undefined;
  readonly " $fragmentSpreads": FragmentRefs<"DashboardPageActivity_query" | "DashboardPageAnalytics_query">;
};
export type DashboardPageQuery = {
  response: DashboardPageQuery$data;
  variables: DashboardPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 100
    }
  ],
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "projects",
  "plural": true,
  "selections": [
    (v1/*: any*/)
  ],
  "storageKey": "projects(first:100)"
},
v3 = {
  "kind": "Variable",
  "name": "projectId",
  "variableName": "projectId"
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v6 = {
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
      "name": "endCursor",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasNextPage",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = {
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
},
v8 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "period",
      "value": "WEEK"
    }
  ],
  "concreteType": "MetricsData",
  "kind": "LinkedField",
  "name": "metrics",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "totalTasks",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "completedTasks",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "successRate",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "averageConfidence",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "calibrationScore",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "significantFrustrations",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "significantFrustrationRate",
      "storageKey": null
    }
  ],
  "storageKey": "metrics(period:\"WEEK\")"
},
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "PluginStats",
  "kind": "LinkedField",
  "name": "pluginStats",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "totalPlugins",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "userPlugins",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "projectPlugins",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "localPlugins",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "enabledPlugins",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "PluginCategory",
  "kind": "LinkedField",
  "name": "pluginCategories",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "category",
      "storageKey": null
    },
    (v10/*: any*/)
  ],
  "storageKey": null
},
v12 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 5
  },
  (v3/*: any*/)
],
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionId",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messageCount",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "date",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionCount",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "inputTokens",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "outputTokens",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalTokens",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "estimatedCostUsd",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "model",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cacheReadTokens",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "slug",
  "storageKey": null
},
v27 = [
  (v13/*: any*/),
  (v26/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "score",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "sentimentTrend",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "avgSentimentScore",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "turnCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "taskCompletionRate",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "compactionCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "focusScore",
    "storageKey": null
  },
  (v15/*: any*/)
],
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "costUsd",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DashboardPageQuery",
    "selections": [
      (v2/*: any*/),
      {
        "alias": "sessions",
        "args": [
          (v3/*: any*/)
        ],
        "concreteType": "SessionConnection",
        "kind": "LinkedField",
        "name": "__DashboardPage_sessions_connection",
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
                  (v1/*: any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "SessionListItem_session"
                  },
                  (v4/*: any*/)
                ],
                "storageKey": null
              },
              (v5/*: any*/)
            ],
            "storageKey": null
          },
          (v6/*: any*/),
          (v7/*: any*/)
        ],
        "storageKey": null
      },
      (v8/*: any*/),
      (v9/*: any*/),
      (v11/*: any*/),
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DashboardPageActivity_query"
      },
      {
        "kind": "Defer",
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "DashboardPageAnalytics_query"
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DashboardPageQuery",
    "selections": [
      (v2/*: any*/),
      {
        "alias": null,
        "args": (v12/*: any*/),
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
                  (v1/*: any*/),
                  (v13/*: any*/),
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
                    "name": "projectName",
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
                  (v14/*: any*/),
                  (v15/*: any*/),
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
                      (v16/*: any*/),
                      (v1/*: any*/)
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
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "totalCount",
                        "storageKey": null
                      },
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
                              (v1/*: any*/),
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
                              (v16/*: any*/)
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
                  (v4/*: any*/)
                ],
                "storageKey": null
              },
              (v5/*: any*/)
            ],
            "storageKey": null
          },
          (v6/*: any*/),
          (v7/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v12/*: any*/),
        "filters": [
          "projectId"
        ],
        "handle": "connection",
        "key": "DashboardPage_sessions",
        "kind": "LinkedHandle",
        "name": "sessions"
      },
      (v8/*: any*/),
      (v9/*: any*/),
      (v11/*: any*/),
      {
        "alias": null,
        "args": [
          {
            "kind": "Literal",
            "name": "days",
            "value": 730
          }
        ],
        "concreteType": "ActivityData",
        "kind": "LinkedField",
        "name": "activity",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DailyActivity",
            "kind": "LinkedField",
            "name": "dailyActivity",
            "plural": true,
            "selections": [
              (v17/*: any*/),
              (v18/*: any*/),
              (v14/*: any*/),
              (v19/*: any*/),
              (v20/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cachedTokens",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "linesAdded",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "linesRemoved",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "filesChanged",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "HourlyActivity",
            "kind": "LinkedField",
            "name": "hourlyActivity",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hour",
                "storageKey": null
              },
              (v18/*: any*/),
              (v14/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "TokenUsageStats",
            "kind": "LinkedField",
            "name": "tokenUsage",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "totalInputTokens",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "totalOutputTokens",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "totalCachedTokens",
                "storageKey": null
              },
              (v21/*: any*/),
              (v22/*: any*/),
              (v14/*: any*/),
              (v18/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "DailyModelTokens",
            "kind": "LinkedField",
            "name": "dailyModelTokens",
            "plural": true,
            "selections": [
              (v17/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ModelTokenEntry",
                "kind": "LinkedField",
                "name": "models",
                "plural": true,
                "selections": [
                  (v23/*: any*/),
                  (v24/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "tokens",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v21/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "ModelUsageStats",
            "kind": "LinkedField",
            "name": "modelUsage",
            "plural": true,
            "selections": [
              (v23/*: any*/),
              (v24/*: any*/),
              (v19/*: any*/),
              (v20/*: any*/),
              (v25/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cacheCreationTokens",
                "storageKey": null
              },
              (v21/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "totalSessions",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "totalMessages",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "firstSessionDate",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "streakDays",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "totalActiveDays",
            "storageKey": null
          }
        ],
        "storageKey": "activity(days:730)"
      },
      {
        "if": null,
        "kind": "Defer",
        "label": "DashboardPageQuery$defer$DashboardPageAnalytics",
        "selections": [
          {
            "alias": null,
            "args": [
              {
                "kind": "Literal",
                "name": "days",
                "value": 30
              }
            ],
            "concreteType": "DashboardAnalytics",
            "kind": "LinkedField",
            "name": "dashboardAnalytics",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "SubagentUsageStats",
                "kind": "LinkedField",
                "name": "subagentUsage",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "subagentType",
                    "storageKey": null
                  },
                  (v10/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "CompactionStats",
                "kind": "LinkedField",
                "name": "compactionStats",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "totalCompactions",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "sessionsWithCompactions",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "sessionsWithoutCompactions",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "avgCompactionsPerSession",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "autoCompactCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "manualCompactCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "continuationCount",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "SessionEffectiveness",
                "kind": "LinkedField",
                "name": "topSessions",
                "plural": true,
                "selections": (v27/*: any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "SessionEffectiveness",
                "kind": "LinkedField",
                "name": "bottomSessions",
                "plural": true,
                "selections": (v27/*: any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ToolUsageStats",
                "kind": "LinkedField",
                "name": "toolUsage",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "toolName",
                    "storageKey": null
                  },
                  (v10/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "HookHealthStats",
                "kind": "LinkedField",
                "name": "hookHealth",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "hookName",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "totalRuns",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "passCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "failCount",
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
                    "kind": "ScalarField",
                    "name": "avgDurationMs",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "CostAnalysis",
                "kind": "LinkedField",
                "name": "costAnalysis",
                "plural": false,
                "selections": [
                  (v22/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "maxSubscriptionCostUsd",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "costUtilizationPercent",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DailyCost",
                    "kind": "LinkedField",
                    "name": "dailyCostTrend",
                    "plural": true,
                    "selections": [
                      (v17/*: any*/),
                      (v28/*: any*/),
                      (v18/*: any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "WeeklyCost",
                    "kind": "LinkedField",
                    "name": "weeklyCostTrend",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "weekStart",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "weekLabel",
                        "storageKey": null
                      },
                      (v28/*: any*/),
                      (v18/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "avgDailyCost",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SessionCost",
                    "kind": "LinkedField",
                    "name": "topSessionsByCost",
                    "plural": true,
                    "selections": [
                      (v13/*: any*/),
                      (v26/*: any*/),
                      (v28/*: any*/),
                      (v19/*: any*/),
                      (v20/*: any*/),
                      (v25/*: any*/),
                      (v14/*: any*/),
                      (v15/*: any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "costPerSession",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "costPerCompletedTask",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cacheHitRate",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "potentialSavingsUsd",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SubscriptionComparison",
                    "kind": "LinkedField",
                    "name": "subscriptionComparisons",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "tierName",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "monthlyCostUsd",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "apiCreditCostUsd",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "savingsUsd",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "savingsPercent",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "recommendation",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "breakEvenDailySpend",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": "dashboardAnalytics(days:30)"
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "c7a934a18264645408d8a85bfabba07c",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "sessions"
          ]
        }
      ]
    },
    "name": "DashboardPageQuery",
    "operationKind": "query",
    "text": "query DashboardPageQuery(\n  $projectId: String\n) {\n  projects(first: 100) {\n    id\n  }\n  sessions(first: 5, projectId: $projectId) {\n    edges {\n      node {\n        id\n        ...SessionListItem_session\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  metrics(period: WEEK) {\n    totalTasks\n    completedTasks\n    successRate\n    averageConfidence\n    calibrationScore\n    significantFrustrations\n    significantFrustrationRate\n  }\n  pluginStats {\n    totalPlugins\n    userPlugins\n    projectPlugins\n    localPlugins\n    enabledPlugins\n  }\n  pluginCategories {\n    category\n    count\n  }\n  ...DashboardPageActivity_query\n  ...DashboardPageAnalytics_query @defer(label: \"DashboardPageQuery$defer$DashboardPageAnalytics\")\n}\n\nfragment DashboardPageActivity_query on Query {\n  activity(days: 730) {\n    dailyActivity {\n      date\n      sessionCount\n      messageCount\n      inputTokens\n      outputTokens\n      cachedTokens\n      linesAdded\n      linesRemoved\n      filesChanged\n    }\n    hourlyActivity {\n      hour\n      sessionCount\n      messageCount\n    }\n    tokenUsage {\n      totalInputTokens\n      totalOutputTokens\n      totalCachedTokens\n      totalTokens\n      estimatedCostUsd\n      messageCount\n      sessionCount\n    }\n    dailyModelTokens {\n      date\n      models {\n        model\n        displayName\n        tokens\n      }\n      totalTokens\n    }\n    modelUsage {\n      model\n      displayName\n      inputTokens\n      outputTokens\n      cacheReadTokens\n      cacheCreationTokens\n      totalTokens\n    }\n    totalSessions\n    totalMessages\n    firstSessionDate\n    streakDays\n    totalActiveDays\n  }\n}\n\nfragment DashboardPageAnalytics_query on Query {\n  dashboardAnalytics(days: 30) {\n    subagentUsage {\n      subagentType\n      count\n    }\n    compactionStats {\n      totalCompactions\n      sessionsWithCompactions\n      sessionsWithoutCompactions\n      avgCompactionsPerSession\n      autoCompactCount\n      manualCompactCount\n      continuationCount\n    }\n    topSessions {\n      sessionId\n      slug\n      score\n      sentimentTrend\n      avgSentimentScore\n      turnCount\n      taskCompletionRate\n      compactionCount\n      focusScore\n      startedAt\n    }\n    bottomSessions {\n      sessionId\n      slug\n      score\n      sentimentTrend\n      avgSentimentScore\n      turnCount\n      taskCompletionRate\n      compactionCount\n      focusScore\n      startedAt\n    }\n    toolUsage {\n      toolName\n      count\n    }\n    hookHealth {\n      hookName\n      totalRuns\n      passCount\n      failCount\n      passRate\n      avgDurationMs\n    }\n    costAnalysis {\n      estimatedCostUsd\n      maxSubscriptionCostUsd\n      costUtilizationPercent\n      dailyCostTrend {\n        date\n        costUsd\n        sessionCount\n      }\n      weeklyCostTrend {\n        weekStart\n        weekLabel\n        costUsd\n        sessionCount\n        avgDailyCost\n      }\n      topSessionsByCost {\n        sessionId\n        slug\n        costUsd\n        inputTokens\n        outputTokens\n        cacheReadTokens\n        messageCount\n        startedAt\n      }\n      costPerSession\n      costPerCompletedTask\n      cacheHitRate\n      potentialSavingsUsd\n      subscriptionComparisons {\n        tierName\n        monthlyCostUsd\n        apiCreditCostUsd\n        savingsUsd\n        savingsPercent\n        recommendation\n      }\n      breakEvenDailySpend\n    }\n  }\n}\n\nfragment SessionListItem_session on Session {\n  id\n  sessionId\n  name\n  projectName\n  projectSlug\n  projectId\n  worktreeName\n  summary\n  messageCount\n  startedAt\n  updatedAt\n  currentTodo {\n    content\n    activeForm\n    status\n    id\n  }\n  activeTasks {\n    totalCount\n    edges {\n      node {\n        id\n        taskId\n        description\n        type\n        status\n      }\n    }\n  }\n  todoCounts {\n    total\n    pending\n    inProgress\n    completed\n  }\n}\n"
  }
};
})();

(node as any).hash = "cd4e699217152884414792144c943800";

export default node;
