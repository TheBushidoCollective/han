/**
 * @generated SignedSource<<757cdf2a34c2be4ed10682b0c7a8b7a7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Granularity = "DAY" | "MONTH" | "WEEK" | "%future added value";
export type TeamDashboardPageQuery$variables = {
  endDate?: string | null | undefined;
  granularity?: Granularity | null | undefined;
  startDate?: string | null | undefined;
};
export type TeamDashboardPageQuery$data = {
  readonly projects: ReadonlyArray<{
    readonly id: string | null | undefined;
  }> | null | undefined;
  readonly teamMetrics: {
    readonly activityTimeline: ReadonlyArray<{
      readonly messageCount: number | null | undefined;
      readonly period: string | null | undefined;
      readonly sessionCount: number | null | undefined;
      readonly taskCount: number | null | undefined;
    }> | null | undefined;
    readonly estimatedCostUsd: number | null | undefined;
    readonly sessionsByPeriod: ReadonlyArray<{
      readonly period: string | null | undefined;
      readonly sessionCount: number | null | undefined;
      readonly taskCount: number | null | undefined;
      readonly tokenUsage: number | null | undefined;
    }> | null | undefined;
    readonly sessionsByProject: ReadonlyArray<{
      readonly projectId: string | null | undefined;
      readonly projectName: string | null | undefined;
      readonly sessionCount: number | null | undefined;
      readonly successRate: number | null | undefined;
      readonly taskCount: number | null | undefined;
    }> | null | undefined;
    readonly taskCompletionMetrics: {
      readonly averageConfidence: number | null | undefined;
      readonly failureCount: number | null | undefined;
      readonly partialCount: number | null | undefined;
      readonly successCount: number | null | undefined;
      readonly successRate: number | null | undefined;
      readonly totalCompleted: number | null | undefined;
      readonly totalCreated: number | null | undefined;
    } | null | undefined;
    readonly tokenUsageAggregation: {
      readonly estimatedCostUsd: number | null | undefined;
      readonly totalCachedTokens: number | null | undefined;
      readonly totalInputTokens: number | null | undefined;
      readonly totalOutputTokens: number | null | undefined;
      readonly totalTokens: number | null | undefined;
    } | null | undefined;
    readonly topContributors: ReadonlyArray<{
      readonly contributorId: string | null | undefined;
      readonly displayName: string | null | undefined;
      readonly sessionCount: number | null | undefined;
      readonly successRate: number | null | undefined;
      readonly taskCount: number | null | undefined;
    }> | null | undefined;
    readonly totalSessions: number | null | undefined;
    readonly totalTasks: number | null | undefined;
    readonly totalTokens: number | null | undefined;
  } | null | undefined;
};
export type TeamDashboardPageQuery = {
  response: TeamDashboardPageQuery$data;
  variables: TeamDashboardPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "endDate"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "granularity"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "startDate"
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalTokens",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "estimatedCostUsd",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionCount",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "taskCount",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "successRate",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "period",
  "storageKey": null
},
v9 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "endDate",
        "variableName": "endDate"
      },
      {
        "kind": "Variable",
        "name": "granularity",
        "variableName": "granularity"
      },
      {
        "kind": "Variable",
        "name": "startDate",
        "variableName": "startDate"
      }
    ],
    "concreteType": "TeamMetrics",
    "kind": "LinkedField",
    "name": "teamMetrics",
    "plural": false,
    "selections": [
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
        "name": "totalTasks",
        "storageKey": null
      },
      (v3/*: any*/),
      (v4/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "ProjectSessionCount",
        "kind": "LinkedField",
        "name": "sessionsByProject",
        "plural": true,
        "selections": [
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
            "name": "projectName",
            "storageKey": null
          },
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "PeriodSessionCount",
        "kind": "LinkedField",
        "name": "sessionsByPeriod",
        "plural": true,
        "selections": [
          (v8/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "tokenUsage",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "TaskCompletionMetrics",
        "kind": "LinkedField",
        "name": "taskCompletionMetrics",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "totalCreated",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "totalCompleted",
            "storageKey": null
          },
          (v7/*: any*/),
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
            "name": "successCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "partialCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "failureCount",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "TokenUsageAggregation",
        "kind": "LinkedField",
        "name": "tokenUsageAggregation",
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
          (v3/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ActivityTimelineEntry",
        "kind": "LinkedField",
        "name": "activityTimeline",
        "plural": true,
        "selections": [
          (v8/*: any*/),
          (v5/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "messageCount",
            "storageKey": null
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ContributorMetrics",
        "kind": "LinkedField",
        "name": "topContributors",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "contributorId",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "displayName",
            "storageKey": null
          },
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/)
        ],
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
        "name": "first",
        "value": 100
      }
    ],
    "concreteType": "Project",
    "kind": "LinkedField",
    "name": "projects",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      }
    ],
    "storageKey": "projects(first:100)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TeamDashboardPageQuery",
    "selections": (v9/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "TeamDashboardPageQuery",
    "selections": (v9/*: any*/)
  },
  "params": {
    "cacheID": "407c09060b5e7f366a3477ee649077b8",
    "id": null,
    "metadata": {},
    "name": "TeamDashboardPageQuery",
    "operationKind": "query",
    "text": "query TeamDashboardPageQuery(\n  $startDate: String\n  $endDate: String\n  $granularity: Granularity\n) {\n  teamMetrics(startDate: $startDate, endDate: $endDate, granularity: $granularity) {\n    totalSessions\n    totalTasks\n    totalTokens\n    estimatedCostUsd\n    sessionsByProject {\n      projectId\n      projectName\n      sessionCount\n      taskCount\n      successRate\n    }\n    sessionsByPeriod {\n      period\n      sessionCount\n      taskCount\n      tokenUsage\n    }\n    taskCompletionMetrics {\n      totalCreated\n      totalCompleted\n      successRate\n      averageConfidence\n      successCount\n      partialCount\n      failureCount\n    }\n    tokenUsageAggregation {\n      totalInputTokens\n      totalOutputTokens\n      totalCachedTokens\n      totalTokens\n      estimatedCostUsd\n    }\n    activityTimeline {\n      period\n      sessionCount\n      messageCount\n      taskCount\n    }\n    topContributors {\n      contributorId\n      displayName\n      sessionCount\n      taskCount\n      successRate\n    }\n  }\n  projects(first: 100) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "1bb407665ce2580086f1689fd19329fd";

export default node;
