/**
 * @generated SignedSource<<29a0d504d93a95c241de2c6bd87d7b6c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type PluginScope = 'LOCAL' | 'PROJECT' | 'USER' | '%future added value';
export type PluginListPageRemoveMutation$variables = {
  marketplace: string;
  name: string;
  scope: PluginScope;
};
export type PluginListPageRemoveMutation$data = {
  readonly removePlugin:
    | {
        readonly message: string | null | undefined;
        readonly success: boolean | null | undefined;
      }
    | null
    | undefined;
};
export type PluginListPageRemoveMutation = {
  response: PluginListPageRemoveMutation$data;
  variables: PluginListPageRemoveMutation$variables;
};

const node: ConcreteRequest = (() => {
  var v0 = {
      defaultValue: null,
      kind: 'LocalArgument',
      name: 'marketplace',
    },
    v1 = {
      defaultValue: null,
      kind: 'LocalArgument',
      name: 'name',
    },
    v2 = {
      defaultValue: null,
      kind: 'LocalArgument',
      name: 'scope',
    },
    v3 = [
      {
        alias: null,
        args: [
          {
            kind: 'Variable',
            name: 'marketplace',
            variableName: 'marketplace',
          },
          {
            kind: 'Variable',
            name: 'name',
            variableName: 'name',
          },
          {
            kind: 'Variable',
            name: 'scope',
            variableName: 'scope',
          },
        ],
        concreteType: 'PluginMutationResult',
        kind: 'LinkedField',
        name: 'removePlugin',
        plural: false,
        selections: [
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'success',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'message',
            storageKey: null,
          },
        ],
        storageKey: null,
      },
    ];
  return {
    fragment: {
      argumentDefinitions: [v0 /*: any*/, v1 /*: any*/, v2 /*: any*/],
      kind: 'Fragment',
      metadata: null,
      name: 'PluginListPageRemoveMutation',
      selections: v3 /*: any*/,
      type: 'Mutation',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: [v1 /*: any*/, v0 /*: any*/, v2 /*: any*/],
      kind: 'Operation',
      name: 'PluginListPageRemoveMutation',
      selections: v3 /*: any*/,
    },
    params: {
      cacheID: 'e4c4567cdccab72df5aea8f9ab177c82',
      id: null,
      metadata: {},
      name: 'PluginListPageRemoveMutation',
      operationKind: 'mutation',
      text: 'mutation PluginListPageRemoveMutation(\n  $name: String!\n  $marketplace: String!\n  $scope: PluginScope!\n) {\n  removePlugin(name: $name, marketplace: $marketplace, scope: $scope) {\n    success\n    message\n  }\n}\n',
    },
  };
})();

(node as any).hash = '03138b42c16d442097fd67f2be4639f7';

export default node;
