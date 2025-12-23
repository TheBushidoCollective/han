/**
 * @generated SignedSource<<930ba82ce2dbabc6e01187fb5077141c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type MetricsPeriod = "DAY" | "MONTH" | "WEEK" | "%future added value";
export type TaskOutcome = "FAILURE" | "PARTIAL" | "SUCCESS" | "%future added value";
export type TaskStatus = "ACTIVE" | "COMPLETED" | "FAILED" | "%future added value";
export type TaskType = "FIX" | "IMPLEMENTATION" | "REFACTOR" | "RESEARCH" | "%future added value";
export type MetricsPageQuery$variables = {
  period?: MetricsPeriod | null | undefined;
};
export type MetricsPageQuery$data = {
  readonly viewer: {
    readonly metrics: {
      readonly averageConfidence: number | null | undefined;
      readonly averageDuration: number | null | undefined;
      readonly calibrationScore: number | null | undefined;
      readonly completedTasks: number | null | undefined;
      readonly recentTasks: ReadonlyArray<{
        readonly completedAt: any | null | undefined;
        readonly confidence: number | null | undefined;
        readonly description: string | null | undefined;
        readonly durationSeconds: number | null | undefined;
        readonly id: string | null | undefined;
        readonly outcome: TaskOutcome | null | undefined;
        readonly startedAt: any | null | undefined;
        readonly status: TaskStatus | null | undefined;
        readonly taskId: string | null | undefined;
        readonly type: TaskType | null | undefined;
      }> | null | undefined;
      readonly significantFrustrationRate: number | null | undefined;
      readonly significantFrustrations: number | null | undefined;
      readonly successRate: number | null | undefined;
      readonly tasksByOutcome: ReadonlyArray<{
        readonly count: number | null | undefined;
        readonly outcome: TaskOutcome | null | undefined;
      }> | null | undefined;
      readonly tasksByType: ReadonlyArray<{
        readonly count: number | null | undefined;
        readonly type: TaskType | null | undefined;
      }> | null | undefined;
      readonly totalTasks: number | null | undefined;
    } | null | undefined;
  } | null | undefined;
};
export type MetricsPageQuery = {
  response: MetricsPageQuery$data;
  variables: MetricsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "period"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "outcome",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "period",
      "variableName": "period"
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
      "name": "averageDuration",
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
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "TaskTypeCount",
      "kind": "LinkedField",
      "name": "tasksByType",
      "plural": true,
      "selections": [
        (v1/*: any*/),
        (v2/*: any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "TaskOutcomeCount",
      "kind": "LinkedField",
      "name": "tasksByOutcome",
      "plural": true,
      "selections": [
        (v3/*: any*/),
        (v2/*: any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 10
        }
      ],
      "concreteType": "Task",
      "kind": "LinkedField",
      "name": "recentTasks",
      "plural": true,
      "selections": [
        (v4/*: any*/),
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
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "status",
          "storageKey": null
        },
        (v3/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "confidence",
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
      "storageKey": "recentTasks(first:10)"
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "MetricsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v5/*: any*/)
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
    "name": "MetricsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v5/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "015be9f2c6a9b25db4048a50f47ad682",
    "id": null,
    "metadata": {},
    "name": "MetricsPageQuery",
    "operationKind": "query",
    "text": "query MetricsPageQuery(\n  $period: MetricsPeriod\n) {\n  viewer {\n    metrics(period: $period) {\n      totalTasks\n      completedTasks\n      successRate\n      averageConfidence\n      averageDuration\n      calibrationScore\n      significantFrustrations\n      significantFrustrationRate\n      tasksByType {\n        type\n        count\n      }\n      tasksByOutcome {\n        outcome\n        count\n      }\n      recentTasks(first: 10) {\n        id\n        taskId\n        description\n        type\n        status\n        outcome\n        confidence\n        startedAt\n        completedAt\n        durationSeconds\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5c37f453ee04a9a85382546aaee9adef";

export default node;
