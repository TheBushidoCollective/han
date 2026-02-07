/**
 * @generated SignedSource<<4284c2b90335aa66582b8b207c05287b>>
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
      readonly cacheHitRate: number | null | undefined;
      readonly costPerCompletedTask: number | null | undefined;
      readonly costPerSession: number | null | undefined;
      readonly costUtilizationPercent: number | null | undefined;
      readonly dailyCostTrend: ReadonlyArray<{
        readonly costUsd: number | null | undefined;
        readonly date: string | null | undefined;
        readonly sessionCount: number | null | undefined;
      }> | null | undefined;
      readonly estimatedCostUsd: number | null | undefined;
      readonly maxSubscriptionCostUsd: number | null | undefined;
      readonly potentialSavingsUsd: number | null | undefined;
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
v1 = [
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
    "name": "slug",
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
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "startedAt",
    "storageKey": null
  }
];
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
          "selections": (v1/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SessionEffectiveness",
          "kind": "LinkedField",
          "name": "bottomSessions",
          "plural": true,
          "selections": (v1/*: any*/),
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
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "estimatedCostUsd",
              "storageKey": null
            },
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
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "date",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "costUsd",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "sessionCount",
                  "storageKey": null
                }
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

(node as any).hash = "7041c0061f600f43eaa606fc400aead3";

export default node;
