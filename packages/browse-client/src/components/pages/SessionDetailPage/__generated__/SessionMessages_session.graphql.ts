/**
 * @generated SignedSource<<4f27a9a7aafca9c3f7751a02bc63b9d1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from 'relay-runtime';
export type SessionMessages_session$data = {
  readonly id: string;
  readonly messageCount: number | null | undefined;
  readonly messages:
    | {
        readonly edges:
          | ReadonlyArray<{
              readonly cursor: string | null | undefined;
              readonly node:
                | {
                    readonly __typename: string;
                    readonly content?: string | null | undefined;
                    readonly id: string | null | undefined;
                    readonly isToolOnly?: boolean | null | undefined;
                    readonly timestamp: any | null | undefined;
                  }
                | null
                | undefined;
            }>
          | null
          | undefined;
        readonly pageInfo:
          | {
              readonly hasPreviousPage: boolean | null | undefined;
              readonly startCursor: string | null | undefined;
            }
          | null
          | undefined;
        readonly totalCount: number | null | undefined;
      }
    | null
    | undefined;
  readonly ' $fragmentType': 'SessionMessages_session';
};
export type SessionMessages_session$key = {
  readonly ' $data'?: SessionMessages_session$data;
  readonly ' $fragmentSpreads': FragmentRefs<'SessionMessages_session'>;
};

import SessionMessagesPaginationQuery_graphql from './SessionMessagesPaginationQuery.graphql';

const node: ReaderFragment = (() => {
  var v0 = ['messages'],
    v1 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'id',
      storageKey: null,
    },
    v2 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'content',
      storageKey: null,
    },
    v3 = [v2 /*: any*/];
  return {
    argumentDefinitions: [
      {
        defaultValue: null,
        kind: 'LocalArgument',
        name: 'before',
      },
      {
        defaultValue: 50,
        kind: 'LocalArgument',
        name: 'last',
      },
    ],
    kind: 'Fragment',
    metadata: {
      connection: [
        {
          count: 'last',
          cursor: 'before',
          direction: 'backward',
          path: v0 /*: any*/,
        },
      ],
      refetch: {
        connection: {
          forward: null,
          backward: {
            count: 'last',
            cursor: 'before',
          },
          path: v0 /*: any*/,
        },
        fragmentPathInResult: ['node'],
        operation: SessionMessagesPaginationQuery_graphql,
        identifierInfo: {
          identifierField: 'id',
          identifierQueryVariableName: 'id',
        },
      },
    },
    name: 'SessionMessages_session',
    selections: [
      {
        alias: null,
        args: null,
        kind: 'ScalarField',
        name: 'messageCount',
        storageKey: null,
      },
      {
        alias: 'messages',
        args: null,
        concreteType: 'MessageConnection',
        kind: 'LinkedField',
        name: '__SessionMessages_messages_connection',
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
                  {
                    alias: null,
                    args: null,
                    kind: 'ScalarField',
                    name: '__typename',
                    storageKey: null,
                  },
                  v1 /*: any*/,
                  {
                    alias: null,
                    args: null,
                    kind: 'ScalarField',
                    name: 'timestamp',
                    storageKey: null,
                  },
                  {
                    kind: 'InlineFragment',
                    selections: v3 /*: any*/,
                    type: 'UserMessage',
                    abstractKey: null,
                  },
                  {
                    kind: 'InlineFragment',
                    selections: [
                      v2 /*: any*/,
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
                    selections: v3 /*: any*/,
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
      v1 /*: any*/,
    ],
    type: 'Session',
    abstractKey: null,
  };
})();

(node as any).hash = 'a2b0f3588d7c50b569b6747d455d214a';

export default node;
