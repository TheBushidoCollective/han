/**
 * @generated SignedSource<<58c5f6b354b695452994e5c33ff6ca86>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DashboardPageAnalytics_query$data = {
  readonly dashboardAnalytics: {
    readonly bottomSessions: ReadonlyArray<{
      readonly avgSentimentScore: number | null | undefined;
      readonly compactionCount: number | null | undefined;
      readonly focusScore: number | null | undefined;
      readonly score: number | null | undefined;
      readonly sentimentTrend: string | null | undefined;
      readonly sessionId: string | null | undefined;
      readonly slug: string | null | undefined;
      readonly startedAt: string | null | undefined;
      readonly summary: string | null | undefined;
      readonly taskCompletionRate: number | null | undefined;
      readonly turnCount: number | null | undefined;
    }> | null | undefined;
    readonly compactionStats: {
      readonly autoCompactCount: number | null | undefined;
      readonly avgCompactionsPerSession: number | null | undefined;
      readonly continuationCount: number | null | undefined;
      readonly manualCompactCount: number | null | undefined;
      readonly sessionsWithCompactions: number | null | undefined;
      readonly sessionsWithoutCompactions: number | null | undefined;
      readonly totalCompactions: number | null | undefined;
    } | null | undefined;
    readonly costAnalysis: {
      readonly billingType: string | null | undefined;
      readonly breakEvenDailySpend: number | null | undefined;
      readonly cacheHitRate: number | null | undefined;
      readonly cacheSavingsUsd: number | null | undefined;
      readonly configDirBreakdowns: ReadonlyArray<{
        readonly breakEvenDailySpend: number | null | undefined;
        readonly cacheHitRate: number | null | undefined;
        readonly cacheSavingsUsd: number | null | undefined;
        readonly configDirId: string | null | undefined;
        readonly configDirName: string | null | undefined;
        readonly costPerSession: number | null | undefined;
        readonly costUtilizationPercent: number | null | undefined;
        readonly dailyCostTrend: ReadonlyArray<{
          readonly costUsd: number | null | undefined;
          readonly date: string | null | undefined;
          readonly sessionCount: number | null | undefined;
        }> | null | undefined;
        readonly estimatedCostUsd: number | null | undefined;
        readonly isEstimated: boolean | null | undefined;
        readonly modelCount: number | null | undefined;
        readonly potentialSavingsUsd: number | null | undefined;
        readonly subscriptionComparisons: ReadonlyArray<{
          readonly apiCreditCostUsd: number | null | undefined;
          readonly monthlyCostUsd: number | null | undefined;
          readonly recommendation: string | null | undefined;
          readonly savingsPercent: number | null | undefined;
          readonly savingsUsd: number | null | undefined;
          readonly tierName: string | null | undefined;
        }> | null | undefined;
        readonly topSessionsByCost: ReadonlyArray<{
          readonly cacheReadTokens: number | null | undefined;
          readonly costUsd: number | null | undefined;
          readonly inputTokens: number | null | undefined;
          readonly messageCount: number | null | undefined;
          readonly outputTokens: number | null | undefined;
          readonly sessionId: string | null | undefined;
          readonly slug: string | null | undefined;
          readonly startedAt: string | null | undefined;
        }> | null | undefined;
        readonly totalMessages: number | null | undefined;
        readonly totalSessions: number | null | undefined;
        readonly weeklyCostTrend: ReadonlyArray<{
          readonly avgDailyCost: number | null | undefined;
          readonly costUsd: number | null | undefined;
          readonly sessionCount: number | null | undefined;
          readonly weekLabel: string | null | undefined;
          readonly weekStart: string | null | undefined;
        }> | null | undefined;
      }> | null | undefined;
      readonly costPerCompletedTask: number | null | undefined;
      readonly costPerSession: number | null | undefined;
      readonly costUtilizationPercent: number | null | undefined;
      readonly dailyCostTrend: ReadonlyArray<{
        readonly costUsd: number | null | undefined;
        readonly date: string | null | undefined;
        readonly sessionCount: number | null | undefined;
      }> | null | undefined;
      readonly estimatedCostUsd: number | null | undefined;
      readonly isEstimated: boolean | null | undefined;
      readonly maxSubscriptionCostUsd: number | null | undefined;
      readonly potentialSavingsUsd: number | null | undefined;
      readonly subscriptionComparisons: ReadonlyArray<{
        readonly apiCreditCostUsd: number | null | undefined;
        readonly monthlyCostUsd: number | null | undefined;
        readonly recommendation: string | null | undefined;
        readonly savingsPercent: number | null | undefined;
        readonly savingsUsd: number | null | undefined;
        readonly tierName: string | null | undefined;
      }> | null | undefined;
      readonly topSessionsByCost: ReadonlyArray<{
        readonly cacheReadTokens: number | null | undefined;
        readonly costUsd: number | null | undefined;
        readonly inputTokens: number | null | undefined;
        readonly messageCount: number | null | undefined;
        readonly outputTokens: number | null | undefined;
        readonly sessionId: string | null | undefined;
        readonly slug: string | null | undefined;
        readonly startedAt: string | null | undefined;
      }> | null | undefined;
      readonly weeklyCostTrend: ReadonlyArray<{
        readonly avgDailyCost: number | null | undefined;
        readonly costUsd: number | null | undefined;
        readonly sessionCount: number | null | undefined;
        readonly weekLabel: string | null | undefined;
        readonly weekStart: string | null | undefined;
      }> | null | undefined;
    } | null | undefined;
    readonly hookHealth: ReadonlyArray<{
      readonly avgDurationMs: number | null | undefined;
      readonly failCount: number | null | undefined;
      readonly hookName: string | null | undefined;
      readonly passCount: number | null | undefined;
      readonly passRate: number | null | undefined;
      readonly totalRuns: number | null | undefined;
    }> | null | undefined;
    readonly subagentUsage: ReadonlyArray<{
      readonly count: number | null | undefined;
      readonly subagentType: string | null | undefined;
    }> | null | undefined;
    readonly toolUsage: ReadonlyArray<{
      readonly count: number | null | undefined;
      readonly toolName: string | null | undefined;
    }> | null | undefined;
    readonly topSessions: ReadonlyArray<{
      readonly avgSentimentScore: number | null | undefined;
      readonly compactionCount: number | null | undefined;
      readonly focusScore: number | null | undefined;
      readonly score: number | null | undefined;
      readonly sentimentTrend: string | null | undefined;
      readonly sessionId: string | null | undefined;
      readonly slug: string | null | undefined;
      readonly startedAt: string | null | undefined;
      readonly summary: string | null | undefined;
      readonly taskCompletionRate: number | null | undefined;
      readonly turnCount: number | null | undefined;
    }> | null | undefined;
  } | null | undefined;
  readonly " $fragmentType": "DashboardPageAnalytics_query";
};
export type DashboardPageAnalytics_query$key = {
  readonly " $data"?: DashboardPageAnalytics_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"DashboardPageAnalytics_query">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionId",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "slug",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v4 = [
  (v1/*: any*/),
  (v2/*: any*/),
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
  (v3/*: any*/)
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "estimatedCostUsd",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isEstimated",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cacheSavingsUsd",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "costUtilizationPercent",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "costUsd",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionCount",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "DailyCost",
  "kind": "LinkedField",
  "name": "dailyCostTrend",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "date",
      "storageKey": null
    },
    (v9/*: any*/),
    (v10/*: any*/)
  ],
  "storageKey": null
},
v12 = {
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
    (v9/*: any*/),
    (v10/*: any*/),
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
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "SessionCost",
  "kind": "LinkedField",
  "name": "topSessionsByCost",
  "plural": true,
  "selections": [
    (v1/*: any*/),
    (v2/*: any*/),
    (v9/*: any*/),
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
      "name": "cacheReadTokens",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "messageCount",
      "storageKey": null
    },
    (v3/*: any*/)
  ],
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "costPerSession",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cacheHitRate",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "potentialSavingsUsd",
  "storageKey": null
},
v17 = {
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
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "breakEvenDailySpend",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DashboardPageAnalytics_query",
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
            (v0/*: any*/)
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
          "selections": (v4/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SessionEffectiveness",
          "kind": "LinkedField",
          "name": "bottomSessions",
          "plural": true,
          "selections": (v4/*: any*/),
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
            (v0/*: any*/)
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
            (v5/*: any*/),
            (v6/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "billingType",
              "storageKey": null
            },
            (v7/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "maxSubscriptionCostUsd",
              "storageKey": null
            },
            (v8/*: any*/),
            (v11/*: any*/),
            (v12/*: any*/),
            (v13/*: any*/),
            (v14/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "costPerCompletedTask",
              "storageKey": null
            },
            (v15/*: any*/),
            (v16/*: any*/),
            (v17/*: any*/),
            (v18/*: any*/),
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
                (v5/*: any*/),
                (v6/*: any*/),
                (v7/*: any*/),
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
                  "name": "modelCount",
                  "storageKey": null
                },
                (v14/*: any*/),
                (v15/*: any*/),
                (v16/*: any*/),
                (v8/*: any*/),
                (v11/*: any*/),
                (v12/*: any*/),
                (v17/*: any*/),
                (v18/*: any*/),
                (v13/*: any*/)
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "dashboardAnalytics(days:30)"
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "981b21ffdaf9ba0aea6fe524f9673f82";

export default node;
