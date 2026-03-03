/**
 * @generated SignedSource<<d12e0f8d208ab2b4470b73882165c603>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PluginScope = "LOCAL" | "PROJECT" | "USER" | "%future added value";
export type SessionFilter = {
  _and?: ReadonlyArray<SessionFilter> | null | undefined;
  _not?: SessionFilter | null | undefined;
  _or?: ReadonlyArray<SessionFilter> | null | undefined;
  id?: StringFilter | null | undefined;
  prNumber?: IntFilter | null | undefined;
  project?: ProjectFilter | null | undefined;
  projectId?: StringFilter | null | undefined;
  slug?: StringFilter | null | undefined;
  status?: StringFilter | null | undefined;
  teamName?: StringFilter | null | undefined;
};
export type StringFilter = {
  _contains?: string | null | undefined;
  _endsWith?: string | null | undefined;
  _eq?: string | null | undefined;
  _in?: ReadonlyArray<string> | null | undefined;
  _isNull?: boolean | null | undefined;
  _ne?: string | null | undefined;
  _notIn?: ReadonlyArray<string> | null | undefined;
  _startsWith?: string | null | undefined;
};
export type IntFilter = {
  _eq?: number | null | undefined;
  _gt?: number | null | undefined;
  _gte?: number | null | undefined;
  _in?: ReadonlyArray<number> | null | undefined;
  _isNull?: boolean | null | undefined;
  _lt?: number | null | undefined;
  _lte?: number | null | undefined;
  _ne?: number | null | undefined;
};
export type ProjectFilter = {
  _and?: ReadonlyArray<ProjectFilter> | null | undefined;
  _not?: ProjectFilter | null | undefined;
  _or?: ReadonlyArray<ProjectFilter> | null | undefined;
  createdAt?: StringFilter | null | undefined;
  isWorktree?: BoolFilter | null | undefined;
  name?: StringFilter | null | undefined;
  path?: StringFilter | null | undefined;
  relativePath?: StringFilter | null | undefined;
  repoId?: StringFilter | null | undefined;
  slug?: StringFilter | null | undefined;
  updatedAt?: StringFilter | null | undefined;
};
export type BoolFilter = {
  _eq?: boolean | null | undefined;
  _isNull?: boolean | null | undefined;
};
export type DashboardPageQuery$variables = {
  hasProjectId: boolean;
  hasRepoId: boolean;
  projectId: string;
  repoId: string;
  sessionFilter?: SessionFilter | null | undefined;
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
  readonly project?: {
    readonly id: string;
    readonly lastActivity: string | null | undefined;
    readonly name: string;
    readonly plugins: ReadonlyArray<{
      readonly category: string | null | undefined;
      readonly enabled: boolean | null | undefined;
      readonly id: string;
      readonly marketplace: string | null | undefined;
      readonly name: string | null | undefined;
      readonly scope: PluginScope | null | undefined;
    }> | null | undefined;
    readonly projectId: string;
    readonly totalSessions: number | null | undefined;
    readonly worktrees: ReadonlyArray<{
      readonly isWorktree: boolean;
      readonly name: string;
      readonly path: string;
      readonly sessionCount: number | null | undefined;
      readonly subdirs: ReadonlyArray<{
        readonly path: string;
        readonly relativePath: string | null | undefined;
        readonly sessionCount: number | null | undefined;
      }> | null | undefined;
    }> | null | undefined;
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
  "name": "hasProjectId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasRepoId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "repoId"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sessionFilter"
},
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "repoId"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectId",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalSessions",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lastActivity",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "path",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionCount",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isWorktree",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "relativePath",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "category",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "Plugin",
  "kind": "LinkedField",
  "name": "plugins",
  "plural": true,
  "selections": [
    (v8/*: any*/),
    (v6/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "marketplace",
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
      "name": "enabled",
      "storageKey": null
    },
    (v16/*: any*/)
  ],
  "storageKey": null
},
v18 = {
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
    (v8/*: any*/)
  ],
  "storageKey": "projects(first:100)"
},
v19 = {
  "kind": "Variable",
  "name": "filter",
  "variableName": "sessionFilter"
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v22 = {
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
v23 = {
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
v24 = {
  "kind": "Variable",
  "name": "projectId",
  "variableName": "projectId"
},
v25 = {
  "kind": "Variable",
  "name": "repoId",
  "variableName": "repoId"
},
v26 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "period",
      "value": "WEEK"
    },
    (v24/*: any*/),
    (v25/*: any*/)
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
  "storageKey": null
},
v27 = {
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
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "concreteType": "PluginCategory",
  "kind": "LinkedField",
  "name": "pluginCategories",
  "plural": true,
  "selections": [
    (v16/*: any*/),
    (v28/*: any*/)
  ],
  "storageKey": null
},
v30 = [
  (v24/*: any*/),
  (v25/*: any*/)
],
v31 = [
  (v19/*: any*/),
  {
    "kind": "Literal",
    "name": "first",
    "value": 5
  }
],
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionId",
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "summary",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messageCount",
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v36 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "turnCount",
  "storageKey": null
},
v38 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "compactionCount",
  "storageKey": null
},
v39 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "estimatedCostUsd",
  "storageKey": null
},
v40 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "date",
  "storageKey": null
},
v41 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "inputTokens",
  "storageKey": null
},
v42 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "outputTokens",
  "storageKey": null
},
v43 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalTokens",
  "storageKey": null
},
v44 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "model",
  "storageKey": null
},
v45 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v46 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cacheReadTokens",
  "storageKey": null
},
v47 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "costUsd",
  "storageKey": null
},
v48 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalMessages",
  "storageKey": null
},
v49 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "slug",
  "storageKey": null
},
v50 = [
  (v32/*: any*/),
  (v49/*: any*/),
  (v33/*: any*/),
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
  (v37/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "taskCompletionRate",
    "storageKey": null
  },
  (v38/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "focusScore",
    "storageKey": null
  },
  (v35/*: any*/)
],
v51 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isEstimated",
  "storageKey": null
},
v52 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cacheSavingsUsd",
  "storageKey": null
},
v53 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "costUtilizationPercent",
  "storageKey": null
},
v54 = {
  "alias": null,
  "args": null,
  "concreteType": "DailyCost",
  "kind": "LinkedField",
  "name": "dailyCostTrend",
  "plural": true,
  "selections": [
    (v40/*: any*/),
    (v47/*: any*/),
    (v13/*: any*/)
  ],
  "storageKey": null
},
v55 = {
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
    (v47/*: any*/),
    (v13/*: any*/),
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
v56 = {
  "alias": null,
  "args": null,
  "concreteType": "SessionCost",
  "kind": "LinkedField",
  "name": "topSessionsByCost",
  "plural": true,
  "selections": [
    (v32/*: any*/),
    (v49/*: any*/),
    (v47/*: any*/),
    (v41/*: any*/),
    (v42/*: any*/),
    (v46/*: any*/),
    (v34/*: any*/),
    (v35/*: any*/)
  ],
  "storageKey": null
},
v57 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "costPerSession",
  "storageKey": null
},
v58 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cacheHitRate",
  "storageKey": null
},
v59 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "potentialSavingsUsd",
  "storageKey": null
},
v60 = {
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
v61 = {
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
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/)
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
            "args": (v5/*: any*/),
            "concreteType": "Repo",
            "kind": "LinkedField",
            "name": "repo",
            "plural": false,
            "selections": [
              (v6/*: any*/)
            ],
            "storageKey": null
          }
        ]
      },
      {
        "condition": "hasProjectId",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v7/*: any*/),
            "concreteType": "Project",
            "kind": "LinkedField",
            "name": "project",
            "plural": false,
            "selections": [
              (v8/*: any*/),
              (v9/*: any*/),
              (v6/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "worktrees",
                "plural": true,
                "selections": [
                  (v6/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/),
                  (v14/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Project",
                    "kind": "LinkedField",
                    "name": "subdirs",
                    "plural": true,
                    "selections": [
                      (v15/*: any*/),
                      (v12/*: any*/),
                      (v13/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v17/*: any*/)
            ],
            "storageKey": null
          }
        ]
      },
      (v18/*: any*/),
      {
        "alias": "sessions",
        "args": [
          (v19/*: any*/)
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
                  (v8/*: any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "SessionListItem_session"
                  },
                  (v20/*: any*/)
                ],
                "storageKey": null
              },
              (v21/*: any*/)
            ],
            "storageKey": null
          },
          (v22/*: any*/),
          (v23/*: any*/)
        ],
        "storageKey": null
      },
      (v26/*: any*/),
      (v27/*: any*/),
      (v29/*: any*/),
      {
        "args": (v30/*: any*/),
        "kind": "FragmentSpread",
        "name": "DashboardPageActivity_query"
      },
      {
        "args": (v30/*: any*/),
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
      (v3/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/),
      (v4/*: any*/)
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
            "args": (v5/*: any*/),
            "concreteType": "Repo",
            "kind": "LinkedField",
            "name": "repo",
            "plural": false,
            "selections": [
              (v6/*: any*/),
              (v8/*: any*/)
            ],
            "storageKey": null
          }
        ]
      },
      {
        "condition": "hasProjectId",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v7/*: any*/),
            "concreteType": "Project",
            "kind": "LinkedField",
            "name": "project",
            "plural": false,
            "selections": [
              (v8/*: any*/),
              (v9/*: any*/),
              (v6/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "worktrees",
                "plural": true,
                "selections": [
                  (v6/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/),
                  (v14/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Project",
                    "kind": "LinkedField",
                    "name": "subdirs",
                    "plural": true,
                    "selections": [
                      (v15/*: any*/),
                      (v12/*: any*/),
                      (v13/*: any*/),
                      (v8/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v8/*: any*/)
                ],
                "storageKey": null
              },
              (v17/*: any*/)
            ],
            "storageKey": null
          }
        ]
      },
      (v18/*: any*/),
      {
        "alias": null,
        "args": (v31/*: any*/),
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
                  (v8/*: any*/),
                  (v32/*: any*/),
                  (v6/*: any*/),
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
                  (v9/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "worktreeName",
                    "storageKey": null
                  },
                  (v33/*: any*/),
                  (v34/*: any*/),
                  (v35/*: any*/),
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
                      (v8/*: any*/),
                      (v6/*: any*/),
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
                      (v36/*: any*/),
                      (v8/*: any*/)
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
                              (v8/*: any*/),
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
                              (v36/*: any*/)
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
                    "name": "gitBranch",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "prNumber",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "prUrl",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "teamName",
                    "storageKey": null
                  },
                  (v37/*: any*/),
                  (v38/*: any*/),
                  (v39/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "duration",
                    "storageKey": null
                  },
                  (v20/*: any*/)
                ],
                "storageKey": null
              },
              (v21/*: any*/)
            ],
            "storageKey": null
          },
          (v22/*: any*/),
          (v23/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v31/*: any*/),
        "filters": [
          "filter"
        ],
        "handle": "connection",
        "key": "DashboardPage_sessions",
        "kind": "LinkedHandle",
        "name": "sessions"
      },
      (v26/*: any*/),
      (v27/*: any*/),
      (v29/*: any*/),
      {
        "alias": null,
        "args": [
          {
            "kind": "Literal",
            "name": "days",
            "value": 730
          },
          (v24/*: any*/),
          (v25/*: any*/)
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
              (v40/*: any*/),
              (v13/*: any*/),
              (v34/*: any*/),
              (v41/*: any*/),
              (v42/*: any*/),
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
              (v13/*: any*/),
              (v34/*: any*/)
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
              (v43/*: any*/),
              (v39/*: any*/),
              (v34/*: any*/),
              (v13/*: any*/)
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
              (v40/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ModelTokenEntry",
                "kind": "LinkedField",
                "name": "models",
                "plural": true,
                "selections": [
                  (v44/*: any*/),
                  (v45/*: any*/),
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
              (v43/*: any*/)
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
              (v44/*: any*/),
              (v45/*: any*/),
              (v41/*: any*/),
              (v42/*: any*/),
              (v46/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cacheCreationTokens",
                "storageKey": null
              },
              (v43/*: any*/),
              (v47/*: any*/)
            ],
            "storageKey": null
          },
          (v10/*: any*/),
          (v48/*: any*/),
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
        "storageKey": null
      },
      {
        "alias": null,
        "args": [
          {
            "kind": "Literal",
            "name": "days",
            "value": 30
          },
          (v24/*: any*/),
          (v25/*: any*/)
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
              (v28/*: any*/)
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
            "selections": (v50/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "SessionEffectiveness",
            "kind": "LinkedField",
            "name": "bottomSessions",
            "plural": true,
            "selections": (v50/*: any*/),
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
              (v28/*: any*/)
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
              (v39/*: any*/),
              (v51/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "billingType",
                "storageKey": null
              },
              (v52/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "maxSubscriptionCostUsd",
                "storageKey": null
              },
              (v53/*: any*/),
              (v54/*: any*/),
              (v55/*: any*/),
              (v56/*: any*/),
              (v57/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "costPerCompletedTask",
                "storageKey": null
              },
              (v58/*: any*/),
              (v59/*: any*/),
              (v60/*: any*/),
              (v61/*: any*/),
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
                  (v39/*: any*/),
                  (v51/*: any*/),
                  (v52/*: any*/),
                  (v10/*: any*/),
                  (v48/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "modelCount",
                    "storageKey": null
                  },
                  (v57/*: any*/),
                  (v58/*: any*/),
                  (v59/*: any*/),
                  (v53/*: any*/),
                  (v54/*: any*/),
                  (v55/*: any*/),
                  (v60/*: any*/),
                  (v61/*: any*/),
                  (v56/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a7ec677407ad53fb433caeb55f05c594",
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
    "text": "query DashboardPageQuery(\n  $repoId: String!\n  $hasRepoId: Boolean!\n  $projectId: String!\n  $hasProjectId: Boolean!\n  $sessionFilter: SessionFilter\n) {\n  repo(id: $repoId) @include(if: $hasRepoId) {\n    name\n    id\n  }\n  project(id: $projectId) @include(if: $hasProjectId) {\n    id\n    projectId\n    name\n    totalSessions\n    lastActivity\n    worktrees {\n      name\n      path\n      sessionCount\n      isWorktree\n      subdirs {\n        relativePath\n        path\n        sessionCount\n        id\n      }\n      id\n    }\n    plugins {\n      id\n      name\n      marketplace\n      scope\n      enabled\n      category\n    }\n  }\n  projects(first: 100) {\n    id\n  }\n  sessions(first: 5, filter: $sessionFilter) {\n    edges {\n      node {\n        id\n        ...SessionListItem_session\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  metrics(period: WEEK, projectId: $projectId, repoId: $repoId) {\n    totalTasks\n    completedTasks\n    successRate\n    averageConfidence\n    calibrationScore\n    significantFrustrations\n    significantFrustrationRate\n  }\n  pluginStats {\n    totalPlugins\n    userPlugins\n    projectPlugins\n    localPlugins\n    enabledPlugins\n  }\n  pluginCategories {\n    category\n    count\n  }\n  ...DashboardPageActivity_query_2Q0WS9\n  ...DashboardPageAnalytics_query_2Q0WS9\n}\n\nfragment DashboardPageActivity_query_2Q0WS9 on Query {\n  activity(days: 730, projectId: $projectId, repoId: $repoId) {\n    dailyActivity {\n      date\n      sessionCount\n      messageCount\n      inputTokens\n      outputTokens\n      cachedTokens\n      linesAdded\n      linesRemoved\n      filesChanged\n    }\n    hourlyActivity {\n      hour\n      sessionCount\n      messageCount\n    }\n    tokenUsage {\n      totalInputTokens\n      totalOutputTokens\n      totalCachedTokens\n      totalTokens\n      estimatedCostUsd\n      messageCount\n      sessionCount\n    }\n    dailyModelTokens {\n      date\n      models {\n        model\n        displayName\n        tokens\n      }\n      totalTokens\n    }\n    modelUsage {\n      model\n      displayName\n      inputTokens\n      outputTokens\n      cacheReadTokens\n      cacheCreationTokens\n      totalTokens\n      costUsd\n    }\n    totalSessions\n    totalMessages\n    firstSessionDate\n    streakDays\n    totalActiveDays\n  }\n}\n\nfragment DashboardPageAnalytics_query_2Q0WS9 on Query {\n  dashboardAnalytics(days: 30, projectId: $projectId, repoId: $repoId) {\n    subagentUsage {\n      subagentType\n      count\n    }\n    compactionStats {\n      totalCompactions\n      sessionsWithCompactions\n      sessionsWithoutCompactions\n      avgCompactionsPerSession\n      autoCompactCount\n      manualCompactCount\n      continuationCount\n    }\n    topSessions {\n      sessionId\n      slug\n      summary\n      score\n      sentimentTrend\n      avgSentimentScore\n      turnCount\n      taskCompletionRate\n      compactionCount\n      focusScore\n      startedAt\n    }\n    bottomSessions {\n      sessionId\n      slug\n      summary\n      score\n      sentimentTrend\n      avgSentimentScore\n      turnCount\n      taskCompletionRate\n      compactionCount\n      focusScore\n      startedAt\n    }\n    toolUsage {\n      toolName\n      count\n    }\n    hookHealth {\n      hookName\n      totalRuns\n      passCount\n      failCount\n      passRate\n      avgDurationMs\n    }\n    costAnalysis {\n      estimatedCostUsd\n      isEstimated\n      billingType\n      cacheSavingsUsd\n      maxSubscriptionCostUsd\n      costUtilizationPercent\n      dailyCostTrend {\n        date\n        costUsd\n        sessionCount\n      }\n      weeklyCostTrend {\n        weekStart\n        weekLabel\n        costUsd\n        sessionCount\n        avgDailyCost\n      }\n      topSessionsByCost {\n        sessionId\n        slug\n        costUsd\n        inputTokens\n        outputTokens\n        cacheReadTokens\n        messageCount\n        startedAt\n      }\n      costPerSession\n      costPerCompletedTask\n      cacheHitRate\n      potentialSavingsUsd\n      subscriptionComparisons {\n        tierName\n        monthlyCostUsd\n        apiCreditCostUsd\n        savingsUsd\n        savingsPercent\n        recommendation\n      }\n      breakEvenDailySpend\n      configDirBreakdowns {\n        configDirId\n        configDirName\n        estimatedCostUsd\n        isEstimated\n        cacheSavingsUsd\n        totalSessions\n        totalMessages\n        modelCount\n        costPerSession\n        cacheHitRate\n        potentialSavingsUsd\n        costUtilizationPercent\n        dailyCostTrend {\n          date\n          costUsd\n          sessionCount\n        }\n        weeklyCostTrend {\n          weekStart\n          weekLabel\n          costUsd\n          sessionCount\n          avgDailyCost\n        }\n        subscriptionComparisons {\n          tierName\n          monthlyCostUsd\n          apiCreditCostUsd\n          savingsUsd\n          savingsPercent\n          recommendation\n        }\n        breakEvenDailySpend\n        topSessionsByCost {\n          sessionId\n          slug\n          costUsd\n          inputTokens\n          outputTokens\n          cacheReadTokens\n          messageCount\n          startedAt\n        }\n      }\n    }\n  }\n}\n\nfragment SessionListItem_session on Session {\n  id\n  sessionId\n  name\n  projectName\n  projectSlug\n  projectId\n  worktreeName\n  summary\n  messageCount\n  startedAt\n  updatedAt\n  owner {\n    id\n    name\n    email\n    avatarUrl\n  }\n  currentTodo {\n    content\n    activeForm\n    status\n    id\n  }\n  activeTasks {\n    totalCount\n    edges {\n      node {\n        id\n        taskId\n        description\n        type\n        status\n      }\n    }\n  }\n  todoCounts {\n    total\n    pending\n    inProgress\n    completed\n  }\n  gitBranch\n  prNumber\n  prUrl\n  teamName\n  turnCount\n  compactionCount\n  estimatedCostUsd\n  duration\n}\n"
  }
};
})();

(node as any).hash = "e506fca12ec3a9b84895f120aad8c6a0";

export default node;
