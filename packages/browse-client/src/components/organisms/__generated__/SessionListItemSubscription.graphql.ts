/**
 * @generated SignedSource<<8ce92a6afeaa2085d5f4ba281e40d492>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest, FragmentRefs } from 'relay-runtime';
export type SessionListItemSubscription$variables = {
  id: string;
};
export type SessionListItemSubscription$data = {
  readonly nodeUpdated:
    | {
        readonly node:
          | {
              readonly ' $fragmentSpreads': FragmentRefs<'SessionListItem_session'>;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};
export type SessionListItemSubscription = {
  response: SessionListItemSubscription$data;
  variables: SessionListItemSubscription$variables;
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
      name: 'status',
      storageKey: null,
    };
  return {
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Fragment',
      metadata: null,
      name: 'SessionListItemSubscription',
      selections: [
        {
          alias: null,
          args: v1 /*: any*/,
          concreteType: 'NodeUpdatedPayload',
          kind: 'LinkedField',
          name: 'nodeUpdated',
          plural: false,
          selections: [
            {
              alias: null,
              args: null,
              concreteType: null,
              kind: 'LinkedField',
              name: 'node',
              plural: false,
              selections: [
                {
                  kind: 'InlineFragment',
                  selections: [
                    {
                      args: null,
                      kind: 'FragmentSpread',
                      name: 'SessionListItem_session',
                    },
                  ],
                  type: 'Session',
                  abstractKey: null,
                },
              ],
              storageKey: null,
            },
          ],
          storageKey: null,
        },
      ],
      type: 'Subscription',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Operation',
      name: 'SessionListItemSubscription',
      selections: [
        {
          alias: null,
          args: v1 /*: any*/,
          concreteType: 'NodeUpdatedPayload',
          kind: 'LinkedField',
          name: 'nodeUpdated',
          plural: false,
          selections: [
            {
              alias: null,
              args: null,
              concreteType: null,
              kind: 'LinkedField',
              name: 'node',
              plural: false,
              selections: [
                {
                  alias: null,
                  args: null,
                  kind: 'ScalarField',
                  name: '__typename',
                  storageKey: null,
                },
                v2 /*: any*/,
                {
                  kind: 'InlineFragment',
                  selections: [
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'sessionId',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'name',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'projectName',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'projectSlug',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'projectId',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'worktreeName',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'summary',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'messageCount',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'startedAt',
                      storageKey: null,
                    },
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'updatedAt',
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
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'content',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'activeForm',
                          storageKey: null,
                        },
                        v3 /*: any*/,
                        v2 /*: any*/,
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
                      selections: [
                        v2 /*: any*/,
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'taskId',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'description',
                          storageKey: null,
                        },
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'type',
                          storageKey: null,
                        },
                        v3 /*: any*/,
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
                        {
                          alias: null,
                          args: null,
                          kind: 'ScalarField',
                          name: 'total',
                          storageKey: null,
                        },
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
                  ],
                  type: 'Session',
                  abstractKey: null,
                },
              ],
              storageKey: null,
            },
          ],
          storageKey: null,
        },
      ],
    },
    params: {
      cacheID: 'a82a8a6cb3d2cabf106e96884e98d452',
      id: null,
      metadata: {},
      name: 'SessionListItemSubscription',
      operationKind: 'subscription',
      text: 'subscription SessionListItemSubscription(\n  $id: ID!\n) {\n  nodeUpdated(id: $id) {\n    node {\n      __typename\n      ... on Session {\n        ...SessionListItem_session\n      }\n      id\n    }\n  }\n}\n\nfragment SessionListItem_session on Session {\n  id\n  sessionId\n  name\n  projectName\n  projectSlug\n  projectId\n  worktreeName\n  summary\n  messageCount\n  startedAt\n  updatedAt\n  currentTodo {\n    content\n    activeForm\n    status\n    id\n  }\n  activeTasks {\n    id\n    taskId\n    description\n    type\n    status\n  }\n  todoCounts {\n    total\n    pending\n    inProgress\n    completed\n  }\n}\n',
    },
  };
})();

(node as any).hash = 'adecb79c745671c270033f761d5feaf5';

export default node;
