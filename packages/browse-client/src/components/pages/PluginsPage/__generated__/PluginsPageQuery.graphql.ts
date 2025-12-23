/**
 * @generated SignedSource<<665f8620204180526a5bd3d93e6110e3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PluginScope = "LOCAL" | "PROJECT" | "USER" | "%future added value";
export type PluginsPageQuery$variables = Record<PropertyKey, never>;
export type PluginsPageQuery$data = {
  readonly viewer: {
    readonly pluginCategories: ReadonlyArray<{
      readonly category: string | null | undefined;
      readonly count: number | null | undefined;
    }> | null | undefined;
    readonly pluginStats: {
      readonly enabledPlugins: number | null | undefined;
      readonly localPlugins: number | null | undefined;
      readonly projectPlugins: number | null | undefined;
      readonly totalPlugins: number | null | undefined;
      readonly userPlugins: number | null | undefined;
    } | null | undefined;
    readonly plugins: ReadonlyArray<{
      readonly category: string | null | undefined;
      readonly enabled: boolean | null | undefined;
      readonly id: string | null | undefined;
      readonly marketplace: string | null | undefined;
      readonly name: string | null | undefined;
      readonly scope: PluginScope | null | undefined;
    }> | null | undefined;
  } | null | undefined;
};
export type PluginsPageQuery = {
  response: PluginsPageQuery$data;
  variables: PluginsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "category",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "concreteType": "Plugin",
  "kind": "LinkedField",
  "name": "plugins",
  "plural": true,
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "marketplace",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "scope",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "enabled",
      "storageKey": null
    },
    (v1/*: any*/)
  ],
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "PluginStats",
  "kind": "LinkedField",
  "name": "pluginStats",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "totalPlugins",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "userPlugins",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "projectPlugins",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "localPlugins",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "enabledPlugins",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "PluginCategory",
  "kind": "LinkedField",
  "name": "pluginCategories",
  "plural": true,
  "selections": [
    (v1/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "count",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PluginsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PluginsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v0/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b401d5b9886df46b406a99e7bd88927e",
    "id": null,
    "metadata": {},
    "name": "PluginsPageQuery",
    "operationKind": "query",
    "text": "query PluginsPageQuery {\n  viewer {\n    plugins {\n      id\n      name\n      marketplace\n      scope\n      enabled\n      category\n    }\n    pluginStats {\n      totalPlugins\n      userPlugins\n      projectPlugins\n      localPlugins\n      enabledPlugins\n    }\n    pluginCategories {\n      category\n      count\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "39bdbec441493c78d7da19219b68a160";

export default node;
