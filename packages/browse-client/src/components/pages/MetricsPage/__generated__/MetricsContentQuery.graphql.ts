/**
 * @generated SignedSource<<23cbc0594413fc85a2c2c617cc3a35e7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type MetricsPeriod = "DAY" | "MONTH" | "WEEK" | "%future added value";
export type TaskOutcome = "FAILURE" | "PARTIAL" | "SUCCESS" | "%future added value";
export type TaskType = "FIX" | "IMPLEMENTATION" | "REFACTOR" | "RESEARCH" | "%future added value";
export type MetricsContentQuery$variables = {
  period?: MetricsPeriod | null | undefined;
};
export type MetricsContentQuery$data = {
  readonly metrics: {
    readonly averageConfidence: number | null | undefined;
    readonly averageDuration: number | null | undefined;
    readonly calibrationScore: number | null | undefined;
    readonly completedTasks: number | null | undefined;
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
};
export type MetricsContentQuery = {
  response: MetricsContentQuery$data;
  variables: MetricsContentQuery$variables;
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
  "name": "count",
  "storageKey": null
},
v2 = [
  {
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "type",
            "storageKey": null
          },
          (v1/*: any*/)
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "outcome",
            "storageKey": null
          },
          (v1/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "MetricsContentQuery",
    "selections": (v2/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "MetricsContentQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "1776daa33bf9564997ae4543d0dc59d9",
    "id": null,
    "metadata": {},
    "name": "MetricsContentQuery",
    "operationKind": "query",
    "text": "query MetricsContentQuery(\n  $period: MetricsPeriod\n) {\n  metrics(period: $period) {\n    totalTasks\n    completedTasks\n    successRate\n    averageConfidence\n    averageDuration\n    calibrationScore\n    significantFrustrations\n    significantFrustrationRate\n    tasksByType {\n      type\n      count\n    }\n    tasksByOutcome {\n      outcome\n      count\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6d598e4db9141f6fad1dece78b02b6dd";

export default node;
