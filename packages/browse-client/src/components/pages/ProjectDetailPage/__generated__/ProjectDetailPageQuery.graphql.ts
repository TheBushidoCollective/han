/**
 * @generated SignedSource<<0035b3fad391a05740dd3942c45f450d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PluginScope = "LOCAL" | "PROJECT" | "USER" | "%future added value";
export type ProjectDetailPageQuery$variables = {
  id: string;
};
export type ProjectDetailPageQuery$data = {
  readonly project: {
    readonly id: string;
    readonly lastActivity: string | null | undefined;
    readonly name: string;
    readonly plugins: ReadonlyArray<{
      readonly category: string | null | undefined;
      readonly enabled: boolean | null | undefined;
      readonly id: string;
      readonly marketplace: string | null | undefined;
      readonly name: string | null | undefined;
      readonly scope: PluginScope | null | undefined;
    }> | null | undefined;
    readonly projectId: string;
    readonly totalSessions: number | null | undefined;
    readonly worktrees: ReadonlyArray<{
      readonly isWorktree: boolean;
      readonly name: string;
      readonly path: string;
      readonly sessionCount: number | null | undefined;
      readonly subdirs: ReadonlyArray<{
        readonly path: string;
        readonly relativePath: string | null | undefined;
        readonly sessionCount: number | null | undefined;
      }> | null | undefined;
    }> | null | undefined;
  } | null | undefined;
};
export type ProjectDetailPageQuery = {
  response: ProjectDetailPageQuery$data;
  variables: ProjectDetailPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectId",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalSessions",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lastActivity",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "path",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionCount",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isWorktree",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "relativePath",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "Plugin",
  "kind": "LinkedField",
  "name": "plugins",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    (v4/*: any*/),
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
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "category",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Project",
        "kind": "LinkedField",
        "name": "project",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Project",
            "kind": "LinkedField",
            "name": "worktrees",
            "plural": true,
            "selections": [
              (v4/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "subdirs",
                "plural": true,
                "selections": [
                  (v10/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v11/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Project",
        "kind": "LinkedField",
        "name": "project",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Project",
            "kind": "LinkedField",
            "name": "worktrees",
            "plural": true,
            "selections": [
              (v4/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "subdirs",
                "plural": true,
                "selections": [
                  (v10/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v2/*: any*/)
                ],
                "storageKey": null
              },
              (v2/*: any*/)
            ],
            "storageKey": null
          },
          (v11/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5d180b14ea1ecb5819576acd3d049c0d",
    "id": null,
    "metadata": {},
    "name": "ProjectDetailPageQuery",
    "operationKind": "query",
    "text": "query ProjectDetailPageQuery(\n  $id: String!\n) {\n  project(id: $id) {\n    id\n    projectId\n    name\n    totalSessions\n    lastActivity\n    worktrees {\n      name\n      path\n      sessionCount\n      isWorktree\n      subdirs {\n        relativePath\n        path\n        sessionCount\n        id\n      }\n      id\n    }\n    plugins {\n      id\n      name\n      marketplace\n      scope\n      enabled\n      category\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e3d2085e711810cd4bc812510e148645";

export default node;
