/**
 * @generated SignedSource<<79d2004ed73a595ab096b46e7f16df29>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type RepoDetailPageQuery$variables = {
  id: string;
};
export type RepoDetailPageQuery$data = {
  readonly repo:
    | {
        readonly id: string;
        readonly lastActivity: any | null | undefined;
        readonly name: string | null | undefined;
        readonly path: string | null | undefined;
        readonly repoId: string | null | undefined;
        readonly totalSessions: number | null | undefined;
      }
    | null
    | undefined;
};
export type RepoDetailPageQuery = {
  response: RepoDetailPageQuery$data;
  variables: RepoDetailPageQuery$variables;
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
        alias: null,
        args: [
          {
            kind: 'Variable',
            name: 'id',
            variableName: 'id',
          },
        ],
        concreteType: 'Repo',
        kind: 'LinkedField',
        name: 'repo',
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
            name: 'repoId',
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
            name: 'path',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'totalSessions',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'lastActivity',
            storageKey: null,
          },
        ],
        storageKey: null,
      },
    ];
  return {
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Fragment',
      metadata: null,
      name: 'RepoDetailPageQuery',
      selections: v1 /*: any*/,
      type: 'Query',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Operation',
      name: 'RepoDetailPageQuery',
      selections: v1 /*: any*/,
    },
    params: {
      cacheID: '59a90cb79993c2537f86e03e23802309',
      id: null,
      metadata: {},
      name: 'RepoDetailPageQuery',
      operationKind: 'query',
      text: 'query RepoDetailPageQuery(\n  $id: String!\n) {\n  repo(id: $id) {\n    id\n    repoId\n    name\n    path\n    totalSessions\n    lastActivity\n  }\n}\n',
    },
  };
})();

(node as any).hash = 'b72cc8978bc108ba17db75815a60f5ac';

export default node;
