/**
 * @generated SignedSource<<f58a510671c649941a5559b4abb7a5f3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DashboardPageQuery$variables = {
  hasRepoId: boolean;
  projectId?: string | null | undefined;
  repoId: string;
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
    readonly id: string;
  }>;
  readonly repo?: {
    readonly name: string;
  } | null | undefined;
  readonly sessions: {
    readonly __id: string;
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"SessionListItem_session">;
      };
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"DashboardPageActivity_query" | "DashboardPageAnalytics_query">;
};
export type DashboardPageQuery = {
  response: DashboardPageQuery$data;
  variables: DashboardPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasRepoId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "repoId"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "repoId"
  }
],
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
  "name": "id",
  "storageKey": null
},
v6 = {
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
    (v5/*: any*/)
  ],
  "storageKey": "projects(first:100)"
},
v7 = {
  "kind": "Variable",
  "name": "projectId",
  "variableName": "projectId"
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
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
v11 = {
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
v12 = {
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
v13 = {
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
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v15 = {
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
    (v14/*: any*/)
  ],
  "storageKey": null
},
v16 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 5
  },
  (v7/*: any*/)
],
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionId",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "summary",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messageCount",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "turnCount",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "compactionCount",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "estimatedCostUsd",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "date",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionCount",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "inputTokens",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "outputTokens",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalTokens",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "model",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cacheReadTokens",
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "costUsd",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalSessions",
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalMessages",
  "storageKey": null
},
v36 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "slug",
  "storageKey": null
},
v37 = [
  (v17/*: any*/),
  (v36/*: any*/),
  (v18/*: any*/),
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
  (v22/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "taskCompletionRate",
    "storageKey": null
  },
  (v23/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "focusScore",
    "storageKey": null
  },
  (v20/*: any*/)
],
v38 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isEstimated",
  "storageKey": null
},
v39 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cacheSavingsUsd",
  "storageKey": null
},
v40 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "costUtilizationPercent",
  "storageKey": null
},
v41 = {
  "alias": null,
  "args": null,
  "concreteType": "DailyCost",
  "kind": "LinkedField",
  "name": "dailyCostTrend",
  "plural": true,
  "selections": [
    (v25/*: any*/),
    (v33/*: any*/),
    (v26/*: any*/)
  ],
  "storageKey": null
},
v42 = {
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
    (v33/*: any*/),
    (v26/*: any*/),
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
v43 = {
  "alias": null,
  "args": null,
  "concreteType": "SessionCost",
  "kind": "LinkedField",
  "name": "topSessionsByCost",
  "plural": true,
  "selections": [
    (v17/*: any*/),
    (v36/*: any*/),
    (v33/*: any*/),
    (v27/*: any*/),
    (v28/*: any*/),
    (v32/*: any*/),
    (v19/*: any*/),
    (v20/*: any*/)
  ],
  "storageKey": null
},
v44 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "costPerSession",
  "storageKey": null
},
v45 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cacheHitRate",
  "storageKey": null
},
v46 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "potentialSavingsUsd",
  "storageKey": null
},
v47 = {
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
v48 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "breakEvenDailySpend",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DashboardPageQuery",
    "selections": [
      {
        "condition": "hasRepoId",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v3/*: any*/),
            "concreteType": "Repo",
            "kind": "LinkedField",
            "name": "repo",
            "plural": false,
            "selections": [
              (v4/*: any*/)
            ],
            "storageKey": null
          }
        ]
      },
      (v6/*: any*/),
      {
        "alias": "sessions",
        "args": [
          (v7/*: any*/)
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
                  (v5/*: any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "SessionListItem_session"
                  },
                  (v8/*: any*/)
                ],
                "storageKey": null
              },
              (v9/*: any*/)
            ],
            "storageKey": null
          },
          (v10/*: any*/),
          (v11/*: any*/)
        ],
        "storageKey": null
      },
      (v12/*: any*/),
      (v13/*: any*/),
      (v15/*: any*/),
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DashboardPageActivity_query"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DashboardPageAnalytics_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "DashboardPageQuery",
    "selections": [
      {
        "condition": "hasRepoId",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v3/*: any*/),
            "concreteType": "Repo",
            "kind": "LinkedField",
            "name": "repo",
            "plural": false,
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/)
            ],
            "storageKey": null
          }
        ]
      },
      (v6/*: any*/),
      {
        "alias": null,
        "args": (v16/*: any*/),
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
                  (v5/*: any*/),
                  (v17/*: any*/),
                  (v4/*: any*/),
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
                  (v18/*: any*/),
                  (v19/*: any*/),
                  (v20/*: any*/),
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
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "owner",
                    "plural": false,
                    "selections": [
                      (v5/*: any*/),
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
                      (v21/*: any*/),
                      (v5/*: any*/)
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
                              (v5/*: any*/),
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
                              (v21/*: any*/)
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
                  (v22/*: any*/),
                  (v23/*: any*/),
                  (v24/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "duration",
                    "storageKey": null
                  },
                  (v8/*: any*/)
                ],
                "storageKey": null
              },
              (v9/*: any*/)
            ],
            "storageKey": null
          },
          (v10/*: any*/),
          (v11/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v16/*: any*/),
        "filters": [
          "projectId"
        ],
        "handle": "connection",
        "key": "DashboardPage_sessions",
        "kind": "LinkedHandle",
        "name": "sessions"
      },
      (v12/*: any*/),
      (v13/*: any*/),
      (v15/*: any*/),
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
              (v25/*: any*/),
              (v26/*: any*/),
              (v19/*: any*/),
              (v27/*: any*/),
              (v28/*: any*/),
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
              (v26/*: any*/),
              (v19/*: any*/)
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
              (v29/*: any*/),
              (v24/*: any*/),
              (v19/*: any*/),
              (v26/*: any*/)
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
              (v25/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ModelTokenEntry",
                "kind": "LinkedField",
                "name": "models",
                "plural": true,
                "selections": [
                  (v30/*: any*/),
                  (v31/*: any*/),
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
              (v29/*: any*/)
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
              (v30/*: any*/),
              (v31/*: any*/),
              (v27/*: any*/),
              (v28/*: any*/),
              (v32/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cacheCreationTokens",
                "storageKey": null
              },
              (v29/*: any*/),
              (v33/*: any*/)
            ],
            "storageKey": null
          },
          (v34/*: any*/),
          (v35/*: any*/),
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
              (v14/*: any*/)
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
            "selections": (v37/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "SessionEffectiveness",
            "kind": "LinkedField",
            "name": "bottomSessions",
            "plural": true,
            "selections": (v37/*: any*/),
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
              (v14/*: any*/)
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
              (v24/*: any*/),
              (v38/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "billingType",
                "storageKey": null
              },
              (v39/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "maxSubscriptionCostUsd",
                "storageKey": null
              },
              (v40/*: any*/),
              (v41/*: any*/),
              (v42/*: any*/),
              (v43/*: any*/),
              (v44/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "costPerCompletedTask",
                "storageKey": null
              },
              (v45/*: any*/),
              (v46/*: any*/),
              (v47/*: any*/),
              (v48/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ConfigDirCostBreakdown",
                "kind": "LinkedField",
                "name": "configDirBreakdowns",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "configDirId",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "configDirName",
                    "storageKey": null
                  },
                  (v24/*: any*/),
                  (v38/*: any*/),
                  (v39/*: any*/),
                  (v34/*: any*/),
                  (v35/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "modelCount",
                    "storageKey": null
                  },
                  (v44/*: any*/),
                  (v45/*: any*/),
                  (v46/*: any*/),
                  (v40/*: any*/),
                  (v41/*: any*/),
                  (v42/*: any*/),
                  (v47/*: any*/),
                  (v48/*: any*/),
                  (v43/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "dashboardAnalytics(days:30)"
      }
    ]
  },
  "params": {
    "cacheID": "bf10460ceb2c014afb664e87017b1170",
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
    "text": "query DashboardPageQuery(\n  $projectId: String\n  $repoId: String!\n  $hasRepoId: Boolean!\n) {\n  repo(id: $repoId) @include(if: $hasRepoId) {\n    name\n    id\n  }\n  projects(first: 100) {\n    id\n  }\n  sessions(first: 5, projectId: $projectId) {\n    edges {\n      node {\n        id\n        ...SessionListItem_session\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  metrics(period: WEEK) {\n    totalTasks\n    completedTasks\n    successRate\n    averageConfidence\n    calibrationScore\n    significantFrustrations\n    significantFrustrationRate\n  }\n  pluginStats {\n    totalPlugins\n    userPlugins\n    projectPlugins\n    localPlugins\n    enabledPlugins\n  }\n  pluginCategories {\n    category\n    count\n  }\n  ...DashboardPageActivity_query\n  ...DashboardPageAnalytics_query\n}\n\nfragment DashboardPageActivity_query on Query {\n  activity(days: 730) {\n    dailyActivity {\n      date\n      sessionCount\n      messageCount\n      inputTokens\n      outputTokens\n      cachedTokens\n      linesAdded\n      linesRemoved\n      filesChanged\n    }\n    hourlyActivity {\n      hour\n      sessionCount\n      messageCount\n    }\n    tokenUsage {\n      totalInputTokens\n      totalOutputTokens\n      totalCachedTokens\n      totalTokens\n      estimatedCostUsd\n      messageCount\n      sessionCount\n    }\n    dailyModelTokens {\n      date\n      models {\n        model\n        displayName\n        tokens\n      }\n      totalTokens\n    }\n    modelUsage {\n      model\n      displayName\n      inputTokens\n      outputTokens\n      cacheReadTokens\n      cacheCreationTokens\n      totalTokens\n      costUsd\n    }\n    totalSessions\n    totalMessages\n    firstSessionDate\n    streakDays\n    totalActiveDays\n  }\n}\n\nfragment DashboardPageAnalytics_query on Query {\n  dashboardAnalytics(days: 30) {\n    subagentUsage {\n      subagentType\n      count\n    }\n    compactionStats {\n      totalCompactions\n      sessionsWithCompactions\n      sessionsWithoutCompactions\n      avgCompactionsPerSession\n      autoCompactCount\n      manualCompactCount\n      continuationCount\n    }\n    topSessions {\n      sessionId\n      slug\n      summary\n      score\n      sentimentTrend\n      avgSentimentScore\n      turnCount\n      taskCompletionRate\n      compactionCount\n      focusScore\n      startedAt\n    }\n    bottomSessions {\n      sessionId\n      slug\n      summary\n      score\n      sentimentTrend\n      avgSentimentScore\n      turnCount\n      taskCompletionRate\n      compactionCount\n      focusScore\n      startedAt\n    }\n    toolUsage {\n      toolName\n      count\n    }\n    hookHealth {\n      hookName\n      totalRuns\n      passCount\n      failCount\n      passRate\n      avgDurationMs\n    }\n    costAnalysis {\n      estimatedCostUsd\n      isEstimated\n      billingType\n      cacheSavingsUsd\n      maxSubscriptionCostUsd\n      costUtilizationPercent\n      dailyCostTrend {\n        date\n        costUsd\n        sessionCount\n      }\n      weeklyCostTrend {\n        weekStart\n        weekLabel\n        costUsd\n        sessionCount\n        avgDailyCost\n      }\n      topSessionsByCost {\n        sessionId\n        slug\n        costUsd\n        inputTokens\n        outputTokens\n        cacheReadTokens\n        messageCount\n        startedAt\n      }\n      costPerSession\n      costPerCompletedTask\n      cacheHitRate\n      potentialSavingsUsd\n      subscriptionComparisons {\n        tierName\n        monthlyCostUsd\n        apiCreditCostUsd\n        savingsUsd\n        savingsPercent\n        recommendation\n      }\n      breakEvenDailySpend\n      configDirBreakdowns {\n        configDirId\n        configDirName\n        estimatedCostUsd\n        isEstimated\n        cacheSavingsUsd\n        totalSessions\n        totalMessages\n        modelCount\n        costPerSession\n        cacheHitRate\n        potentialSavingsUsd\n        costUtilizationPercent\n        dailyCostTrend {\n          date\n          costUsd\n          sessionCount\n        }\n        weeklyCostTrend {\n          weekStart\n          weekLabel\n          costUsd\n          sessionCount\n          avgDailyCost\n        }\n        subscriptionComparisons {\n          tierName\n          monthlyCostUsd\n          apiCreditCostUsd\n          savingsUsd\n          savingsPercent\n          recommendation\n        }\n        breakEvenDailySpend\n        topSessionsByCost {\n          sessionId\n          slug\n          costUsd\n          inputTokens\n          outputTokens\n          cacheReadTokens\n          messageCount\n          startedAt\n        }\n      }\n    }\n  }\n}\n\nfragment SessionListItem_session on Session {\n  id\n  sessionId\n  name\n  projectName\n  projectSlug\n  projectId\n  worktreeName\n  summary\n  messageCount\n  startedAt\n  updatedAt\n  owner {\n    id\n    name\n    email\n    avatarUrl\n  }\n  currentTodo {\n    content\n    activeForm\n    status\n    id\n  }\n  activeTasks {\n    totalCount\n    edges {\n      node {\n        id\n        taskId\n        description\n        type\n        status\n      }\n    }\n  }\n  todoCounts {\n    total\n    pending\n    inProgress\n    completed\n  }\n  turnCount\n  compactionCount\n  estimatedCostUsd\n  duration\n}\n"
  }
};
})();

(node as any).hash = "4702caed9737cb6ac95aeb65944e377a";

export default node;
