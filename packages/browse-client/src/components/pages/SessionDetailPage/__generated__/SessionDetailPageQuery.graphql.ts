/**
 * @generated SignedSource<<f8efdb0d668414f93c27268d1e8ca50e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CheckpointType = "AGENT" | "SESSION" | "%future added value";
export type MessageType = "ASSISTANT" | "SUMMARY" | "USER" | "%future added value";
export type TaskOutcome = "FAILURE" | "PARTIAL" | "SUCCESS" | "%future added value";
export type TaskStatus = "ACTIVE" | "COMPLETED" | "FAILED" | "%future added value";
export type TaskType = "FIX" | "IMPLEMENTATION" | "REFACTOR" | "RESEARCH" | "%future added value";
export type TodoStatus = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "%future added value";
export type SessionDetailPageQuery$variables = {
  id: string;
};
export type SessionDetailPageQuery$data = {
  readonly session: {
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
    readonly date: string | null | undefined;
    readonly endedAt: any | null | undefined;
    readonly gitBranch: string | null | undefined;
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
    readonly id: string | null | undefined;
    readonly messageCount: number | null | undefined;
    readonly messages: ReadonlyArray<{
      readonly content: string | null | undefined;
      readonly id: string | null | undefined;
      readonly isToolOnly: boolean | null | undefined;
      readonly timestamp: any | null | undefined;
      readonly type: MessageType | null | undefined;
    }> | null | undefined;
    readonly projectName: string | null | undefined;
    readonly projectPath: string | null | undefined;
    readonly sessionId: string | null | undefined;
    readonly startedAt: any | null | undefined;
    readonly summary: string | null | undefined;
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
    readonly version: string | null | undefined;
    readonly worktreeName: string | null | undefined;
  } | null | undefined;
};
export type SessionDetailPageQuery = {
  response: SessionDetailPageQuery$data;
  variables: SessionDetailPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
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
  "name": "projectName",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectPath",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "worktreeName",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "summary",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messageCount",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endedAt",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "gitBranch",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "version",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "timestamp",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 500
    }
  ],
  "concreteType": "Message",
  "kind": "LinkedField",
  "name": "messages",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    (v14/*: any*/),
    (v15/*: any*/),
    (v16/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isToolOnly",
      "storageKey": null
    }
  ],
  "storageKey": "messages(first:500)"
},
v18 = {
  "alias": null,
  "args": null,
  "concreteType": "Checkpoint",
  "kind": "LinkedField",
  "name": "checkpoints",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "checkpointId",
      "storageKey": null
    },
    (v14/*: any*/),
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
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hookType",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "passed",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "concreteType": "HookExecution",
  "kind": "LinkedField",
  "name": "hookExecutions",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    (v19/*: any*/),
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
    (v20/*: any*/),
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
    (v16/*: any*/)
  ],
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "total",
  "storageKey": null
},
v23 = {
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
        (v19/*: any*/),
        (v22/*: any*/),
        (v20/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "activeForm",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "concreteType": "Todo",
  "kind": "LinkedField",
  "name": "todos",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    (v15/*: any*/),
    (v24/*: any*/),
    (v25/*: any*/)
  ],
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "concreteType": "TodoCounts",
  "kind": "LinkedField",
  "name": "todoCounts",
  "plural": false,
  "selections": [
    (v22/*: any*/),
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
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "taskId",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "concreteType": "Task",
  "kind": "LinkedField",
  "name": "tasks",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    (v28/*: any*/),
    (v29/*: any*/),
    (v14/*: any*/),
    (v24/*: any*/),
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
v31 = [
  (v2/*: any*/),
  (v28/*: any*/),
  (v29/*: any*/),
  (v14/*: any*/),
  (v24/*: any*/),
  (v10/*: any*/)
],
v32 = {
  "alias": null,
  "args": null,
  "concreteType": "Task",
  "kind": "LinkedField",
  "name": "activeTasks",
  "plural": true,
  "selections": (v31/*: any*/),
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "concreteType": "Task",
  "kind": "LinkedField",
  "name": "currentTask",
  "plural": false,
  "selections": (v31/*: any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Session",
        "kind": "LinkedField",
        "name": "session",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/),
          (v9/*: any*/),
          (v10/*: any*/),
          (v11/*: any*/),
          (v12/*: any*/),
          (v13/*: any*/),
          (v17/*: any*/),
          (v18/*: any*/),
          (v21/*: any*/),
          (v23/*: any*/),
          (v26/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Todo",
            "kind": "LinkedField",
            "name": "currentTodo",
            "plural": false,
            "selections": [
              (v15/*: any*/),
              (v25/*: any*/),
              (v24/*: any*/)
            ],
            "storageKey": null
          },
          (v27/*: any*/),
          (v30/*: any*/),
          (v32/*: any*/),
          (v33/*: any*/)
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
    "name": "SessionDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Session",
        "kind": "LinkedField",
        "name": "session",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/),
          (v9/*: any*/),
          (v10/*: any*/),
          (v11/*: any*/),
          (v12/*: any*/),
          (v13/*: any*/),
          (v17/*: any*/),
          (v18/*: any*/),
          (v21/*: any*/),
          (v23/*: any*/),
          (v26/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Todo",
            "kind": "LinkedField",
            "name": "currentTodo",
            "plural": false,
            "selections": [
              (v15/*: any*/),
              (v25/*: any*/),
              (v24/*: any*/),
              (v2/*: any*/)
            ],
            "storageKey": null
          },
          (v27/*: any*/),
          (v30/*: any*/),
          (v32/*: any*/),
          (v33/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e97aafb30050edaf92a7df7775e12aee",
    "id": null,
    "metadata": {},
    "name": "SessionDetailPageQuery",
    "operationKind": "query",
    "text": "query SessionDetailPageQuery(\n  $id: String!\n) {\n  session(id: $id) {\n    id\n    sessionId\n    date\n    projectName\n    projectPath\n    worktreeName\n    summary\n    messageCount\n    startedAt\n    endedAt\n    gitBranch\n    version\n    messages(first: 500) {\n      id\n      type\n      content\n      timestamp\n      isToolOnly\n    }\n    checkpoints {\n      id\n      checkpointId\n      type\n      createdAt\n      fileCount\n      patternCount\n      patterns\n    }\n    hookExecutions {\n      id\n      hookType\n      hookName\n      hookSource\n      durationMs\n      passed\n      output\n      error\n      timestamp\n    }\n    hookStats {\n      totalHooks\n      passedHooks\n      failedHooks\n      totalDurationMs\n      passRate\n      byHookType {\n        hookType\n        total\n        passed\n      }\n    }\n    todos {\n      id\n      content\n      status\n      activeForm\n    }\n    currentTodo {\n      content\n      activeForm\n      status\n      id\n    }\n    todoCounts {\n      total\n      pending\n      inProgress\n      completed\n    }\n    tasks {\n      id\n      taskId\n      description\n      type\n      status\n      outcome\n      confidence\n      startedAt\n      completedAt\n      durationSeconds\n    }\n    activeTasks {\n      id\n      taskId\n      description\n      type\n      status\n      startedAt\n    }\n    currentTask {\n      id\n      taskId\n      description\n      type\n      status\n      startedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8eba64cc870fcef5a8031c44cb4b91fe";

export default node;
