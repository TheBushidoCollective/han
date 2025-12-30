/**
 * @generated SignedSource<<9947a81326c1667d3a42e07655ebfd9c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TaskStatus = "ACTIVE" | "COMPLETED" | "FAILED" | "%future added value";
export type TaskType = "FIX" | "IMPLEMENTATION" | "REFACTOR" | "RESEARCH" | "%future added value";
export type TodoStatus = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "%future added value";
export type DashboardPageQuery$variables = Record<PropertyKey, never>;
export type DashboardPageQuery$data = {
  readonly viewer: {
    readonly checkpointStats: {
      readonly agentCheckpoints: number | null | undefined;
      readonly sessionCheckpoints: number | null | undefined;
      readonly totalCheckpoints: number | null | undefined;
    } | null | undefined;
    readonly id: string | null | undefined;
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
      readonly projectPlugins: number | null | undefined;
      readonly totalPlugins: number | null | undefined;
      readonly userPlugins: number | null | undefined;
    } | null | undefined;
    readonly projects: ReadonlyArray<{
      readonly id: string | null | undefined;
    }> | null | undefined;
    readonly sessions: ReadonlyArray<{
      readonly currentTask: {
        readonly description: string | null | undefined;
        readonly id: string | null | undefined;
        readonly status: TaskStatus | null | undefined;
        readonly taskId: string | null | undefined;
        readonly type: TaskType | null | undefined;
      } | null | undefined;
      readonly currentTodo: {
        readonly activeForm: string | null | undefined;
        readonly content: string | null | undefined;
        readonly status: TodoStatus | null | undefined;
      } | null | undefined;
      readonly date: string | null | undefined;
      readonly id: string | null | undefined;
      readonly messageCount: number | null | undefined;
      readonly projectName: string | null | undefined;
      readonly sessionId: string | null | undefined;
      readonly startedAt: any | null | undefined;
      readonly summary: string | null | undefined;
      readonly todoCounts: {
        readonly completed: number | null | undefined;
        readonly inProgress: number | null | undefined;
        readonly pending: number | null | undefined;
        readonly total: number | null | undefined;
      } | null | undefined;
    }> | null | undefined;
  } | null | undefined;
};
export type DashboardPageQuery = {
  response: DashboardPageQuery$data;
  variables: DashboardPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
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
    (v0/*: any*/)
  ],
  "storageKey": "projects(first:100)"
},
v2 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 5
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
  "name": "date",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectName",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "summary",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messageCount",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "activeForm",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v12 = {
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
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "Task",
  "kind": "LinkedField",
  "name": "currentTask",
  "plural": false,
  "selections": [
    (v0/*: any*/),
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
    (v11/*: any*/)
  ],
  "storageKey": null
},
v14 = {
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
v15 = {
  "alias": null,
  "args": null,
  "concreteType": "CheckpointStats",
  "kind": "LinkedField",
  "name": "checkpointStats",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "totalCheckpoints",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "sessionCheckpoints",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "agentCheckpoints",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v16 = {
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
      "name": "enabledPlugins",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v17 = {
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
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "count",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DashboardPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          (v1/*: any*/),
          {
            "alias": null,
            "args": (v2/*: any*/),
            "concreteType": "Session",
            "kind": "LinkedField",
            "name": "sessions",
            "plural": true,
            "selections": [
              (v0/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Todo",
                "kind": "LinkedField",
                "name": "currentTodo",
                "plural": false,
                "selections": [
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/)
                ],
                "storageKey": null
              },
              (v12/*: any*/),
              (v13/*: any*/)
            ],
            "storageKey": "sessions(first:5)"
          },
          (v14/*: any*/),
          (v15/*: any*/),
          (v16/*: any*/),
          (v17/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DashboardPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          (v1/*: any*/),
          {
            "alias": null,
            "args": (v2/*: any*/),
            "concreteType": "Session",
            "kind": "LinkedField",
            "name": "sessions",
            "plural": true,
            "selections": [
              (v0/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Todo",
                "kind": "LinkedField",
                "name": "currentTodo",
                "plural": false,
                "selections": [
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/),
                  (v0/*: any*/)
                ],
                "storageKey": null
              },
              (v12/*: any*/),
              (v13/*: any*/)
            ],
            "storageKey": "sessions(first:5)"
          },
          (v14/*: any*/),
          (v15/*: any*/),
          (v16/*: any*/),
          (v17/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "217a2f885699922dfe7ff7723533e89a",
    "id": null,
    "metadata": {},
    "name": "DashboardPageQuery",
    "operationKind": "query",
    "text": "query DashboardPageQuery {\n  viewer {\n    id\n    projects(first: 100) {\n      id\n    }\n    sessions(first: 5) {\n      id\n      sessionId\n      date\n      startedAt\n      projectName\n      summary\n      messageCount\n      currentTodo {\n        content\n        activeForm\n        status\n        id\n      }\n      todoCounts {\n        total\n        pending\n        inProgress\n        completed\n      }\n      currentTask {\n        id\n        taskId\n        description\n        type\n        status\n      }\n    }\n    metrics(period: WEEK) {\n      totalTasks\n      completedTasks\n      successRate\n      averageConfidence\n      calibrationScore\n      significantFrustrations\n      significantFrustrationRate\n    }\n    checkpointStats {\n      totalCheckpoints\n      sessionCheckpoints\n      agentCheckpoints\n    }\n    pluginStats {\n      totalPlugins\n      userPlugins\n      projectPlugins\n      enabledPlugins\n    }\n    pluginCategories {\n      category\n      count\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "754105e126af6631b55e1eb376f8473a";

export default node;
