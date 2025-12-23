/**
 * @generated SignedSource<<ec9e68bf14b95972be9998b95248aa23>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type CheckpointType = "AGENT" | "SESSION" | "%future added value";
export type TaskOutcome = "FAILURE" | "PARTIAL" | "SUCCESS" | "%future added value";
export type TaskStatus = "ACTIVE" | "COMPLETED" | "FAILED" | "%future added value";
export type TaskType = "FIX" | "IMPLEMENTATION" | "REFACTOR" | "RESEARCH" | "%future added value";
export type TodoStatus = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type SessionExpensiveFields_session$data = {
  readonly activeTasks: ReadonlyArray<{
    readonly description: string | null | undefined;
    readonly id: string | null | undefined;
    readonly startedAt: any | null | undefined;
    readonly status: TaskStatus | null | undefined;
    readonly taskId: string | null | undefined;
    readonly type: TaskType | null | undefined;
  }> | null | undefined;
  readonly checkpoints: ReadonlyArray<{
    readonly checkpointId: string | null | undefined;
    readonly createdAt: any | null | undefined;
    readonly fileCount: number | null | undefined;
    readonly id: string | null | undefined;
    readonly patternCount: number | null | undefined;
    readonly patterns: ReadonlyArray<string> | null | undefined;
    readonly type: CheckpointType | null | undefined;
  }> | null | undefined;
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
  readonly hookExecutions: ReadonlyArray<{
    readonly durationMs: number | null | undefined;
    readonly error: string | null | undefined;
    readonly hookName: string | null | undefined;
    readonly hookSource: string | null | undefined;
    readonly hookType: string | null | undefined;
    readonly id: string | null | undefined;
    readonly output: string | null | undefined;
    readonly passed: boolean | null | undefined;
    readonly timestamp: string | null | undefined;
  }> | null | undefined;
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
  readonly tasks: ReadonlyArray<{
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
  readonly todoCounts: {
    readonly completed: number | null | undefined;
    readonly inProgress: number | null | undefined;
    readonly pending: number | null | undefined;
    readonly total: number | null | undefined;
  } | null | undefined;
  readonly todos: ReadonlyArray<{
    readonly activeForm: string | null | undefined;
    readonly content: string | null | undefined;
    readonly id: string | null | undefined;
    readonly status: TodoStatus | null | undefined;
  }> | null | undefined;
  readonly " $fragmentType": "SessionExpensiveFields_session";
};
export type SessionExpensiveFields_session$key = {
  readonly " $data"?: SessionExpensiveFields_session$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionExpensiveFields_session">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
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
  "name": "hookType",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "passed",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "total",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "activeForm",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "taskId",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v11 = [
  (v0/*: any*/),
  (v8/*: any*/),
  (v9/*: any*/),
  (v1/*: any*/),
  (v6/*: any*/),
  (v10/*: any*/)
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SessionExpensiveFields_session",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Checkpoint",
      "kind": "LinkedField",
      "name": "checkpoints",
      "plural": true,
      "selections": [
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "checkpointId",
          "storageKey": null
        },
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "createdAt",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "fileCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "patternCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "patterns",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "HookExecution",
      "kind": "LinkedField",
      "name": "hookExecutions",
      "plural": true,
      "selections": [
        (v0/*: any*/),
        (v2/*: any*/),
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
          "name": "hookSource",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "durationMs",
          "storageKey": null
        },
        (v3/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "output",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "error",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "timestamp",
          "storageKey": null
        }
      ],
      "storageKey": null
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
            (v2/*: any*/),
            (v4/*: any*/),
            (v3/*: any*/)
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
      "name": "todos",
      "plural": true,
      "selections": [
        (v0/*: any*/),
        (v5/*: any*/),
        (v6/*: any*/),
        (v7/*: any*/)
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
        (v5/*: any*/),
        (v7/*: any*/),
        (v6/*: any*/)
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
        (v4/*: any*/),
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
      "concreteType": "Task",
      "kind": "LinkedField",
      "name": "tasks",
      "plural": true,
      "selections": [
        (v0/*: any*/),
        (v8/*: any*/),
        (v9/*: any*/),
        (v1/*: any*/),
        (v6/*: any*/),
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
        (v10/*: any*/),
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
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Task",
      "kind": "LinkedField",
      "name": "activeTasks",
      "plural": true,
      "selections": (v11/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Task",
      "kind": "LinkedField",
      "name": "currentTask",
      "plural": false,
      "selections": (v11/*: any*/),
      "storageKey": null
    }
  ],
  "type": "Session",
  "abstractKey": null
};
})();

(node as any).hash = "4278c8fba763b13c1eef052fe26b261b";

export default node;
