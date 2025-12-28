/**
 * @generated SignedSource<<3975a7aae574b8734e4bf808da50fe78>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest, FragmentRefs } from 'relay-runtime';
export type SessionMessagesPaginationQuery$variables = {
  before?: string | null | undefined;
  id: string;
  last?: number | null | undefined;
};
export type SessionMessagesPaginationQuery$data = {
  readonly node:
    | {
        readonly ' $fragmentSpreads': FragmentRefs<'SessionMessages_session'>;
      }
    | null
    | undefined;
};
export type SessionMessagesPaginationQuery = {
  response: SessionMessagesPaginationQuery$data;
  variables: SessionMessagesPaginationQuery$variables;
};

const node: ConcreteRequest = (() => {
  var v0 = {
      defaultValue: null,
      kind: 'LocalArgument',
      name: 'before',
    },
    v1 = {
      defaultValue: null,
      kind: 'LocalArgument',
      name: 'id',
    },
    v2 = {
      defaultValue: 50,
      kind: 'LocalArgument',
      name: 'last',
    },
    v3 = [
      {
        kind: 'Variable',
        name: 'id',
        variableName: 'id',
      },
    ],
    v4 = [
      {
        kind: 'Variable',
        name: 'before',
        variableName: 'before',
      },
      {
        kind: 'Variable',
        name: 'last',
        variableName: 'last',
      },
    ],
    v5 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: '__typename',
      storageKey: null,
    },
    v6 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'id',
      storageKey: null,
    },
    v7 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'content',
      storageKey: null,
    },
    v8 = [v7 /*: any*/];
  return {
    fragment: {
      argumentDefinitions: [v0 /*: any*/, v1 /*: any*/, v2 /*: any*/],
      kind: 'Fragment',
      metadata: null,
      name: 'SessionMessagesPaginationQuery',
      selections: [
        {
          alias: null,
          args: v3 /*: any*/,
          concreteType: null,
          kind: 'LinkedField',
          name: 'node',
          plural: false,
          selections: [
            {
              args: v4 /*: any*/,
              kind: 'FragmentSpread',
              name: 'SessionMessages_session',
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
      argumentDefinitions: [v0 /*: any*/, v2 /*: any*/, v1 /*: any*/],
      kind: 'Operation',
      name: 'SessionMessagesPaginationQuery',
      selections: [
        {
          alias: null,
          args: v3 /*: any*/,
          concreteType: null,
          kind: 'LinkedField',
          name: 'node',
          plural: false,
          selections: [
            v5 /*: any*/,
            v6 /*: any*/,
            {
              kind: 'InlineFragment',
              selections: [
                {
                  alias: null,
                  args: null,
                  kind: 'ScalarField',
                  name: 'messageCount',
                  storageKey: null,
                },
                {
                  alias: null,
                  args: v4 /*: any*/,
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
                            v5 /*: any*/,
                            v6 /*: any*/,
                            {
                              alias: null,
                              args: null,
                              kind: 'ScalarField',
                              name: 'timestamp',
                              storageKey: null,
                            },
                            {
                              kind: 'InlineFragment',
                              selections: v8 /*: any*/,
                              type: 'UserMessage',
                              abstractKey: null,
                            },
                            {
                              kind: 'InlineFragment',
                              selections: [
                                v7 /*: any*/,
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
                              selections: v8 /*: any*/,
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
                  storageKey: null,
                },
                {
                  alias: null,
                  args: v4 /*: any*/,
                  filters: null,
                  handle: 'connection',
                  key: 'SessionMessages_messages',
                  kind: 'LinkedHandle',
                  name: 'messages',
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
      cacheID: '6036b88d28c2678f1c6d63e56180bc4b',
      id: null,
      metadata: {},
      name: 'SessionMessagesPaginationQuery',
      operationKind: 'query',
      text: 'query SessionMessagesPaginationQuery(\n  $before: String\n  $last: Int = 50\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...SessionMessages_session_SKUZh\n    id\n  }\n}\n\nfragment SessionMessages_session_SKUZh on Session {\n  messageCount\n  messages(last: $last, before: $before) {\n    edges {\n      node {\n        __typename\n        id\n        timestamp\n        ... on UserMessage {\n          content\n        }\n        ... on AssistantMessage {\n          content\n          isToolOnly\n        }\n        ... on SummaryMessage {\n          content\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      hasPreviousPage\n      startCursor\n    }\n    totalCount\n  }\n  id\n}\n',
    },
  };
})();

(node as any).hash = 'a2b0f3588d7c50b569b6747d455d214a';

export default node;
