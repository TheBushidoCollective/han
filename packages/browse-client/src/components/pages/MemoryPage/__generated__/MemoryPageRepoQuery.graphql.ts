/**
 * @generated SignedSource<<50c1401c7262e3c5350f9d3858613652>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type MemoryPageRepoQuery$variables = {
  repoId: string;
};
export type MemoryPageRepoQuery$data = {
  readonly repo:
    | {
        readonly path: string | null | undefined;
      }
    | null
    | undefined;
};
export type MemoryPageRepoQuery = {
  response: MemoryPageRepoQuery$data;
  variables: MemoryPageRepoQuery$variables;
};

const node: ConcreteRequest = (() => {
  var v0 = [
      {
        defaultValue: null,
        kind: 'LocalArgument',
        name: 'repoId',
      },
    ],
    v1 = [
      {
        kind: 'Variable',
        name: 'id',
        variableName: 'repoId',
      },
    ],
    v2 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'path',
      storageKey: null,
    };
  return {
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: 'Fragment',
      metadata: null,
      name: 'MemoryPageRepoQuery',
      selections: [
        {
          alias: null,
          args: v1 /*: any*/,
          concreteType: 'Repo',
          kind: 'LinkedField',
          name: 'repo',
          plural: false,
          selections: [v2 /*: any*/],
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
      name: 'MemoryPageRepoQuery',
      selections: [
        {
          alias: null,
          args: v1 /*: any*/,
          concreteType: 'Repo',
          kind: 'LinkedField',
          name: 'repo',
          plural: false,
          selections: [
            v2 /*: any*/,
            {
              alias: null,
              args: null,
              kind: 'ScalarField',
              name: 'id',
              storageKey: null,
            },
          ],
          storageKey: null,
        },
      ],
    },
    params: {
      cacheID: '86f83a04161657a60b999206e1201064',
      id: null,
      metadata: {},
      name: 'MemoryPageRepoQuery',
      operationKind: 'query',
      text: 'query MemoryPageRepoQuery(\n  $repoId: String!\n) {\n  repo(id: $repoId) {\n    path\n    id\n  }\n}\n',
    },
  };
})();

(node as any).hash = '65c682b46f2019fb88fafb94fbc39839';

export default node;
