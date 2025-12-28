/**
 * @generated SignedSource<<ebc00db0bd3e9f76946ed73863ac065c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest, FragmentRefs } from 'relay-runtime';
export type SessionDetailPageQuery$variables = {
  id: string;
};
export type SessionDetailPageQuery$data = {
  readonly node:
    | {
        readonly date?: string | null | undefined;
        readonly gitBranch?: string | null | undefined;
        readonly id?: string;
        readonly messageCount?: number | null | undefined;
        readonly projectId?: string | null | undefined;
        readonly projectName?: string | null | undefined;
        readonly projectPath?: string | null | undefined;
        readonly sessionId?: string | null | undefined;
        readonly startedAt?: any | null | undefined;
        readonly summary?: string | null | undefined;
        readonly updatedAt?: any | null | undefined;
        readonly version?: string | null | undefined;
        readonly worktreeName?: string | null | undefined;
        readonly ' $fragmentSpreads': FragmentRefs<
          'SessionExpensiveFields_session' | 'SessionMessages_session'
        >;
      }
    | null
    | undefined;
};
export type SessionDetailPageQuery = {
  response: SessionDetailPageQuery$data;
  variables: SessionDetailPageQuery$variables;
};

const node: ConcreteRequest = (() => {
  var v0 = [
      {
        defaultValue: null,
        kind: 'LocalArgument',
        name: 'id',
      },
    ],
    v1 = [
      {
        kind: 'Variable',
        name: 'id',
        variableName: 'id',
      },
    ],
    v2 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'id',
      storageKey: null,
    },
    v3 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'sessionId',
      storageKey: null,
    },
    v4 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'date',
      storageKey: null,
    },
    v5 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'projectName',
      storageKey: null,
    },
    v6 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'projectPath',
      storageKey: null,
    },
    v7 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'projectId',
      storageKey: null,
    },
    v8 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'worktreeName',
      storageKey: null,
    },
    v9 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'summary',
      storageKey: null,
    },
    v10 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'messageCount',
      storageKey: null,
    },
    v11 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'startedAt',
      storageKey: null,
    },
    v12 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'updatedAt',
      storageKey: null,
    },
    v13 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'gitBranch',
      storageKey: null,
    },
    v14 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'version',
      storageKey: null,
    },
    v15 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: '__typename',
      storageKey: null,
    },
    v16 = [
      {
        kind: 'Literal',
        name: 'last',
        value: 50,
      },
    ],
    v17 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'timestamp',
      storageKey: null,
    },
    v18 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'content',
      storageKey: null,
    },
    v19 = [v18 /*: any*/],
    v20 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'type',
      storageKey: null,
    },
    v21 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'hookType',
      storageKey: null,
    },
    v22 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'passed',
      storageKey: null,
    },
    v23 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'total',
      storageKey: null,
    },
    v24 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'status',
      storageKey: null,
    },
    v25 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'activeForm',
      storageKey: null,
    },
    v26 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'taskId',
      storageKey: null,
    },
    v27 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'description',
      storageKey: null,
    },
    v28 = [
      v2 /*: any*/,
      v26 /*: any*/,
      v27 /*: any*/,
      v20 /*: any*/,
      v24 /*: any*/,
      v11 /*: any*/,
    ];
  return {
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Fragment',
      metadata: null,
      name: 'SessionDetailPageQuery',
      selections: [
        {
          alias: null,
          args: v1 /*: any*/,
          concreteType: null,
          kind: 'LinkedField',
          name: 'node',
          plural: false,
          selections: [
            {
              kind: 'InlineFragment',
              selections: [
                v2 /*: any*/,
                v3 /*: any*/,
                v4 /*: any*/,
                v5 /*: any*/,
                v6 /*: any*/,
                v7 /*: any*/,
                v8 /*: any*/,
                v9 /*: any*/,
                v10 /*: any*/,
                v11 /*: any*/,
                v12 /*: any*/,
                v13 /*: any*/,
                v14 /*: any*/,
                {
                  args: null,
                  kind: 'FragmentSpread',
                  name: 'SessionMessages_session',
                },
                {
                  kind: 'Defer',
                  selections: [
                    {
                      args: null,
                      kind: 'FragmentSpread',
                      name: 'SessionExpensiveFields_session',
                    },
                  ],
                },
              ],
              type: 'Session',
              abstractKey: null,
            },
          ],
          storageKey: null,
        },
      ],
      type: 'Query',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Operation',
      name: 'SessionDetailPageQuery',
      selections: [
        {
          alias: null,
          args: v1 /*: any*/,
          concreteType: null,
          kind: 'LinkedField',
          name: 'node',
          plural: false,
          selections: [
            v15 /*: any*/,
            v2 /*: any*/,
            {
              kind: 'InlineFragment',
              selections: [
                v3 /*: any*/,
                v4 /*: any*/,
                v5 /*: any*/,
                v6 /*: any*/,
                v7 /*: any*/,
                v8 /*: any*/,
                v9 /*: any*/,
                v10 /*: any*/,
                v11 /*: any*/,
                v12 /*: any*/,
                v13 /*: any*/,
                v14 /*: any*/,
                {
                  alias: null,
                  args: v16 /*: any*/,
                  concreteType: 'MessageConnection',
                  kind: 'LinkedField',
                  name: 'messages',
                  plural: false,
                  selections: [
                    {
                      alias: null,
                      args: null,
                      concreteType: 'MessageEdge',
                      kind: 'LinkedField',
                      name: 'edges',
                      plural: true,
                      selections: [
                        {
                          alias: null,
                          args: null,
                          concreteType: null,
                          kind: 'LinkedField',
                          name: 'node',
                          plural: false,
                          selections: [
                            v15 /*: any*/,
                            v2 /*: any*/,
                            v17 /*: any*/,
                            {
                              kind: 'InlineFragment',
                              selections: v19 /*: any*/,
                              type: 'UserMessage',
                              abstractKey: null,
                            },
                            {
                              kind: 'InlineFragment',
                              selections: [
                                v18 /*: any*/,
                                {
                                  alias: null,
                                  args: null,
                                  kind: 'ScalarField',
                                  name: 'isToolOnly',
                                  storageKey: null,
                                },
                              ],
                              type: 'AssistantMessage',
                              abstractKey: null,
                            },
                            {
                              kind: 'InlineFragment',
                              selections: v19 /*: any*/,
                              type: 'SummaryMessage',
                              abstractKey: null,
                            },
                          ],
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'cursor',
                          storageKey: null,
                        },
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'PageInfo',
                      kind: 'LinkedField',
                      name: 'pageInfo',
                      plural: false,
                      selections: [
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'hasPreviousPage',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'startCursor',
                          storageKey: null,
                        },
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'totalCount',
                      storageKey: null,
                    },
                  ],
                  storageKey: 'messages(last:50)',
                },
                {
                  alias: null,
                  args: v16 /*: any*/,
                  filters: null,
                  handle: 'connection',
                  key: 'SessionMessages_messages',
                  kind: 'LinkedHandle',
                  name: 'messages',
                },
                {
                  if: null,
                  kind: 'Defer',
                  label:
                    'SessionDetailPageQuery$defer$SessionExpensiveFields_session',
                  selections: [
                    {
                      alias: null,
                      args: null,
                      concreteType: 'Checkpoint',
                      kind: 'LinkedField',
                      name: 'checkpoints',
                      plural: true,
                      selections: [
                        v2 /*: any*/,
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'checkpointId',
                          storageKey: null,
                        },
                        v20 /*: any*/,
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'createdAt',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'fileCount',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'patternCount',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'patterns',
                          storageKey: null,
                        },
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'HookExecution',
                      kind: 'LinkedField',
                      name: 'hookExecutions',
                      plural: true,
                      selections: [
                        v2 /*: any*/,
                        v21 /*: any*/,
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'hookName',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'hookSource',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'durationMs',
                          storageKey: null,
                        },
                        v22 /*: any*/,
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'output',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'error',
                          storageKey: null,
                        },
                        v17 /*: any*/,
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'HookStats',
                      kind: 'LinkedField',
                      name: 'hookStats',
                      plural: false,
                      selections: [
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'totalHooks',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'passedHooks',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'failedHooks',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'totalDurationMs',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'passRate',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          concreteType: 'HookTypeStat',
                          kind: 'LinkedField',
                          name: 'byHookType',
                          plural: true,
                          selections: [
                            v21 /*: any*/,
                            v23 /*: any*/,
                            v22 /*: any*/,
                          ],
                          storageKey: null,
                        },
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'Todo',
                      kind: 'LinkedField',
                      name: 'todos',
                      plural: true,
                      selections: [
                        v2 /*: any*/,
                        v18 /*: any*/,
                        v24 /*: any*/,
                        v25 /*: any*/,
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'Todo',
                      kind: 'LinkedField',
                      name: 'currentTodo',
                      plural: false,
                      selections: [
                        v18 /*: any*/,
                        v25 /*: any*/,
                        v24 /*: any*/,
                        v2 /*: any*/,
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'TodoCounts',
                      kind: 'LinkedField',
                      name: 'todoCounts',
                      plural: false,
                      selections: [
                        v23 /*: any*/,
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'pending',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'inProgress',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'completed',
                          storageKey: null,
                        },
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'Task',
                      kind: 'LinkedField',
                      name: 'tasks',
                      plural: true,
                      selections: [
                        v2 /*: any*/,
                        v26 /*: any*/,
                        v27 /*: any*/,
                        v20 /*: any*/,
                        v24 /*: any*/,
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'outcome',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'confidence',
                          storageKey: null,
                        },
                        v11 /*: any*/,
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'completedAt',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'durationSeconds',
                          storageKey: null,
                        },
                      ],
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'Task',
                      kind: 'LinkedField',
                      name: 'activeTasks',
                      plural: true,
                      selections: v28 /*: any*/,
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      concreteType: 'Task',
                      kind: 'LinkedField',
                      name: 'currentTask',
                      plural: false,
                      selections: v28 /*: any*/,
                      storageKey: null,
                    },
                  ],
                },
              ],
              type: 'Session',
              abstractKey: null,
            },
          ],
          storageKey: null,
        },
      ],
    },
    params: {
      cacheID: 'ddab94b5e8c7f332b8f402166d04244e',
      id: null,
      metadata: {},
      name: 'SessionDetailPageQuery',
      operationKind: 'query',
      text: 'query SessionDetailPageQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Session {\n      id\n      sessionId\n      date\n      projectName\n      projectPath\n      projectId\n      worktreeName\n      summary\n      messageCount\n      startedAt\n      updatedAt\n      gitBranch\n      version\n      ...SessionMessages_session\n      ...SessionExpensiveFields_session @defer(label: "SessionDetailPageQuery$defer$SessionExpensiveFields_session")\n    }\n    id\n  }\n}\n\nfragment SessionExpensiveFields_session on Session {\n  checkpoints {\n    id\n    checkpointId\n    type\n    createdAt\n    fileCount\n    patternCount\n    patterns\n  }\n  hookExecutions {\n    id\n    hookType\n    hookName\n    hookSource\n    durationMs\n    passed\n    output\n    error\n    timestamp\n  }\n  hookStats {\n    totalHooks\n    passedHooks\n    failedHooks\n    totalDurationMs\n    passRate\n    byHookType {\n      hookType\n      total\n      passed\n    }\n  }\n  todos {\n    id\n    content\n    status\n    activeForm\n  }\n  currentTodo {\n    content\n    activeForm\n    status\n    id\n  }\n  todoCounts {\n    total\n    pending\n    inProgress\n    completed\n  }\n  tasks {\n    id\n    taskId\n    description\n    type\n    status\n    outcome\n    confidence\n    startedAt\n    completedAt\n    durationSeconds\n  }\n  activeTasks {\n    id\n    taskId\n    description\n    type\n    status\n    startedAt\n  }\n  currentTask {\n    id\n    taskId\n    description\n    type\n    status\n    startedAt\n  }\n}\n\nfragment SessionMessages_session on Session {\n  messageCount\n  messages(last: 50) {\n    edges {\n      node {\n        __typename\n        id\n        timestamp\n        ... on UserMessage {\n          content\n        }\n        ... on AssistantMessage {\n          content\n          isToolOnly\n        }\n        ... on SummaryMessage {\n          content\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasPreviousPage\n      startCursor\n    }\n    totalCount\n  }\n  id\n}\n',
    },
  };
})();

(node as any).hash = '2e34727d84115e9a6822000d5ba316ab';

export default node;
