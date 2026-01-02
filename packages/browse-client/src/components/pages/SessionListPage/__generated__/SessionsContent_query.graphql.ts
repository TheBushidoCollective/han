/**
 * @generated SignedSource<<70ec646c643f90a65751622a6e3329e6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from 'relay-runtime';
export type SessionsContent_query$data = {
  readonly sessions:
    | {
        readonly __id: string;
        readonly edges:
          | ReadonlyArray<{
              readonly cursor: string | null | undefined;
              readonly node:
                | {
                    readonly gitBranch: string | null | undefined;
                    readonly id: string;
                    readonly projectName: string | null | undefined;
                    readonly sessionId: string | null | undefined;
                    readonly startedAt: any | null | undefined;
                    readonly summary: string | null | undefined;
                    readonly updatedAt: any | null | undefined;
                    readonly worktreeName: string | null | undefined;
                    readonly ' $fragmentSpreads': FragmentRefs<'SessionListItem_session'>;
                  }
                | null
                | undefined;
            }>
          | null
          | undefined;
        readonly pageInfo:
          | {
              readonly endCursor: string | null | undefined;
              readonly hasNextPage: boolean | null | undefined;
            }
          | null
          | undefined;
        readonly totalCount: number | null | undefined;
      }
    | null
    | undefined;
  readonly ' $fragmentType': 'SessionsContent_query';
};
export type SessionsContent_query$key = {
  readonly ' $data'?: SessionsContent_query$data;
  readonly ' $fragmentSpreads': FragmentRefs<'SessionsContent_query'>;
};

import SessionsContentPaginationQuery_graphql from './SessionsContentPaginationQuery.graphql';

const node: ReaderFragment = (() => {
  var v0 = ['sessions'];
  return {
    argumentDefinitions: [
      {
        defaultValue: null,
        kind: 'LocalArgument',
        name: 'after',
      },
      {
        defaultValue: 50,
        kind: 'LocalArgument',
        name: 'first',
      },
      {
        defaultValue: null,
        kind: 'LocalArgument',
        name: 'projectId',
      },
      {
        defaultValue: null,
        kind: 'LocalArgument',
        name: 'worktreeName',
      },
    ],
    kind: 'Fragment',
    metadata: {
      connection: [
        {
          count: 'first',
          cursor: 'after',
          direction: 'forward',
          path: v0 /*: any*/,
        },
      ],
      refetch: {
        connection: {
          forward: {
            count: 'first',
            cursor: 'after',
          },
          backward: null,
          path: v0 /*: any*/,
        },
        fragmentPathInResult: [],
        operation: SessionsContentPaginationQuery_graphql,
      },
    },
    name: 'SessionsContent_query',
    selections: [
      {
        alias: 'sessions',
        args: [
          {
            kind: 'Variable',
            name: 'projectId',
            variableName: 'projectId',
          },
          {
            kind: 'Variable',
            name: 'worktreeName',
            variableName: 'worktreeName',
          },
        ],
        concreteType: 'SessionConnection',
        kind: 'LinkedField',
        name: '__SessionsContent_sessions_connection',
        plural: false,
        selections: [
          {
            alias: null,
            args: null,
            concreteType: 'SessionEdge',
            kind: 'LinkedField',
            name: 'edges',
            plural: true,
            selections: [
              {
                alias: null,
                args: null,
                concreteType: 'Session',
                kind: 'LinkedField',
                name: 'node',
                plural: false,
                selections: [
                  {
                    alias: null,
                    args: null,
                    kind: 'ScalarField',
                    name: 'id',
                    storageKey: null,
                  },
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
                    name: 'projectName',
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
                    name: 'updatedAt',
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
                    name: 'gitBranch',
                    storageKey: null,
                  },
                  {
                    args: null,
                    kind: 'FragmentSpread',
                    name: 'SessionListItem_session',
                  },
                  {
                    alias: null,
                    args: null,
                    kind: 'ScalarField',
                    name: '__typename',
                    storageKey: null,
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
                name: 'hasNextPage',
                storageKey: null,
              },
              {
                alias: null,
                args: null,
                kind: 'ScalarField',
                name: 'endCursor',
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
          {
            kind: 'ClientExtension',
            selections: [
              {
                alias: null,
                args: null,
                kind: 'ScalarField',
                name: '__id',
                storageKey: null,
              },
            ],
          },
        ],
        storageKey: null,
      },
    ],
    type: 'Query',
    abstractKey: null,
  };
})();

(node as any).hash = 'ebd12c3104a5b2b59fdd22be4e683259';

export default node;
