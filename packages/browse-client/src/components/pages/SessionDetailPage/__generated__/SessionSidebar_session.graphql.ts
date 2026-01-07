/**
 * @generated SignedSource<<1e0945a07c80da0549eef00e7947da94>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type TaskOutcome = "FAILURE" | "PARTIAL" | "SUCCESS" | "%future added value";
export type TaskStatus = "ACTIVE" | "COMPLETED" | "FAILED" | "%future added value";
export type TaskType = "FIX" | "IMPLEMENTATION" | "REFACTOR" | "RESEARCH" | "%future added value";
export type TodoStatus = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type SessionSidebar_session$data = {
  readonly activeTasks: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly description: string | null | undefined;
        readonly id: string | null | undefined;
        readonly startedAt: any | null | undefined;
        readonly status: TaskStatus | null | undefined;
        readonly taskId: string | null | undefined;
        readonly type: TaskType | null | undefined;
      } | null | undefined;
    }> | null | undefined;
    readonly totalCount: number | null | undefined;
  } | null | undefined;
  readonly currentTask: {
    readonly description: string | null | undefined;
    readonly id: string | null | undefined;
    readonly startedAt: any | null | undefined;
    readonly status: TaskStatus | null | undefined;
    readonly taskId: string | null | undefined;
    readonly type: TaskType | null | undefined;
  } | null | undefined;
  readonly currentTodo: {
    readonly activeForm: string | null | undefined;
    readonly content: string | null | undefined;
    readonly status: TodoStatus | null | undefined;
  } | null | undefined;
  readonly frustrationSummary: {
    readonly averageScore: number | null | undefined;
    readonly highCount: number | null | undefined;
    readonly moderateCount: number | null | undefined;
    readonly overallLevel: string | null | undefined;
    readonly peakScore: number | null | undefined;
    readonly topSignals: ReadonlyArray<string> | null | undefined;
    readonly totalAnalyzed: number | null | undefined;
  } | null | undefined;
  readonly hookStats: {
    readonly byHookType: ReadonlyArray<{
      readonly hookType: string | null | undefined;
      readonly passed: number | null | undefined;
      readonly total: number | null | undefined;
    }> | null | undefined;
    readonly failedHooks: number | null | undefined;
    readonly passRate: number | null | undefined;
    readonly passedHooks: number | null | undefined;
    readonly totalDurationMs: number | null | undefined;
    readonly totalHooks: number | null | undefined;
  } | null | undefined;
  readonly tasks: {
    readonly edges: ReadonlyArray<{
      readonly node: {
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
      } | null | undefined;
    }> | null | undefined;
    readonly totalCount: number | null | undefined;
  } | null | undefined;
  readonly todoCounts: {
    readonly completed: number | null | undefined;
    readonly inProgress: number | null | undefined;
    readonly pending: number | null | undefined;
    readonly total: number | null | undefined;
  } | null | undefined;
  readonly todos: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly activeForm: string | null | undefined;
        readonly content: string | null | undefined;
        readonly id: string | null | undefined;
        readonly status: TodoStatus | null | undefined;
      } | null | undefined;
    }> | null | undefined;
    readonly totalCount: number | null | undefined;
  } | null | undefined;
  readonly " $fragmentSpreads": FragmentRefs<"SessionSidebar_fileChanges" | "SessionSidebar_hookExecutions">;
  readonly " $fragmentType": "SessionSidebar_session";
};
export type SessionSidebar_session$key = {
  readonly " $data"?: SessionSidebar_session$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionSidebar_session">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "total",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalCount",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "activeForm",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "taskId",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v10 = [
  (v2/*: any*/),
  (v6/*: any*/),
  (v7/*: any*/),
  (v8/*: any*/),
  (v4/*: any*/),
  (v9/*: any*/)
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SessionSidebar_session",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SessionSidebar_hookExecutions"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SessionSidebar_fileChanges"
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "HookStats",
      "kind": "LinkedField",
      "name": "hookStats",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalHooks",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "passedHooks",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "failedHooks",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalDurationMs",
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
          "concreteType": "HookTypeStat",
          "kind": "LinkedField",
          "name": "byHookType",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hookType",
              "storageKey": null
            },
            (v0/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "passed",
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
      "concreteType": "FrustrationSummary",
      "kind": "LinkedField",
      "name": "frustrationSummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalAnalyzed",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "moderateCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "highCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "overallLevel",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "averageScore",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "peakScore",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "topSignals",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "TodoConnection",
      "kind": "LinkedField",
      "name": "todos",
      "plural": false,
      "selections": [
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "TodoEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Todo",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v2/*: any*/),
                (v3/*: any*/),
                (v4/*: any*/),
                (v5/*: any*/)
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
      "concreteType": "Todo",
      "kind": "LinkedField",
      "name": "currentTodo",
      "plural": false,
      "selections": [
        (v3/*: any*/),
        (v5/*: any*/),
        (v4/*: any*/)
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
        (v0/*: any*/),
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
      "concreteType": "TaskConnection",
      "kind": "LinkedField",
      "name": "tasks",
      "plural": false,
      "selections": [
        (v1/*: any*/),
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
                (v2/*: any*/),
                (v6/*: any*/),
                (v7/*: any*/),
                (v8/*: any*/),
                (v4/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "outcome",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "confidence",
                  "storageKey": null
                },
                (v9/*: any*/),
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
      "concreteType": "TaskConnection",
      "kind": "LinkedField",
      "name": "activeTasks",
      "plural": false,
      "selections": [
        (v1/*: any*/),
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
              "selections": (v10/*: any*/),
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
      "concreteType": "Task",
      "kind": "LinkedField",
      "name": "currentTask",
      "plural": false,
      "selections": (v10/*: any*/),
      "storageKey": null
    }
  ],
  "type": "Session",
  "abstractKey": null
};
})();

(node as any).hash = "73aa838201f6ab2a08fb134b7ece75fd";

export default node;
