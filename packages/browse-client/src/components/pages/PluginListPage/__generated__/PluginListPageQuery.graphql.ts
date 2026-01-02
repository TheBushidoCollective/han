/**
 * @generated SignedSource<<a54108e1a088c55880ef8c9fc75172b3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type PluginScope = 'LOCAL' | 'PROJECT' | 'USER' | '%future added value';
export type PluginListPageQuery$variables = Record<PropertyKey, never>;
export type PluginListPageQuery$data = {
  readonly pluginCategories:
    | ReadonlyArray<{
        readonly category: string | null | undefined;
        readonly count: number | null | undefined;
      }>
    | null
    | undefined;
  readonly pluginStats:
    | {
        readonly enabledPlugins: number | null | undefined;
        readonly localPlugins: number | null | undefined;
        readonly projectPlugins: number | null | undefined;
        readonly totalPlugins: number | null | undefined;
        readonly userPlugins: number | null | undefined;
      }
    | null
    | undefined;
  readonly plugins:
    | ReadonlyArray<{
        readonly category: string | null | undefined;
        readonly enabled: boolean | null | undefined;
        readonly id: string | null | undefined;
        readonly marketplace: string | null | undefined;
        readonly name: string | null | undefined;
        readonly scope: PluginScope | null | undefined;
      }>
    | null
    | undefined;
};
export type PluginListPageQuery = {
  response: PluginListPageQuery$data;
  variables: PluginListPageQuery$variables;
};

const node: ConcreteRequest = (() => {
  var v0 = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'category',
      storageKey: null,
    },
    v1 = [
      {
        alias: null,
        args: null,
        concreteType: 'Plugin',
        kind: 'LinkedField',
        name: 'plugins',
        plural: true,
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
            name: 'name',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'marketplace',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'scope',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'enabled',
            storageKey: null,
          },
          v0 /*: any*/,
        ],
        storageKey: null,
      },
      {
        alias: null,
        args: null,
        concreteType: 'PluginStats',
        kind: 'LinkedField',
        name: 'pluginStats',
        plural: false,
        selections: [
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'totalPlugins',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'userPlugins',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'projectPlugins',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'localPlugins',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'enabledPlugins',
            storageKey: null,
          },
        ],
        storageKey: null,
      },
      {
        alias: null,
        args: null,
        concreteType: 'PluginCategory',
        kind: 'LinkedField',
        name: 'pluginCategories',
        plural: true,
        selections: [
          v0 /*: any*/,
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'count',
            storageKey: null,
          },
        ],
        storageKey: null,
      },
    ];
  return {
    fragment: {
      argumentDefinitions: [],
      kind: 'Fragment',
      metadata: null,
      name: 'PluginListPageQuery',
      selections: v1 /*: any*/,
      type: 'Query',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: [],
      kind: 'Operation',
      name: 'PluginListPageQuery',
      selections: v1 /*: any*/,
    },
    params: {
      cacheID: 'f54fd74e5608d662ca56e16662792156',
      id: null,
      metadata: {},
      name: 'PluginListPageQuery',
      operationKind: 'query',
      text: 'query PluginListPageQuery {\n  plugins {\n    id\n    name\n    marketplace\n    scope\n    enabled\n    category\n  }\n  pluginStats {\n    totalPlugins\n    userPlugins\n    projectPlugins\n    localPlugins\n    enabledPlugins\n  }\n  pluginCategories {\n    category\n    count\n  }\n}\n',
    },
  };
})();

(node as any).hash = '5444371961615eb5c3bdb0df5910b2e8';

export default node;
