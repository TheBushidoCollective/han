/**
 * @generated SignedSource<<c5b07625aca55bf8dbc837881c4dee0a>>
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
    readonly id: string | null | undefined;
    readonly lastActivity: any | null | undefined;
    readonly name: string | null | undefined;
    readonly plugins: ReadonlyArray<{
      readonly category: string | null | undefined;
      readonly enabled: boolean | null | undefined;
      readonly id: string | null | undefined;
      readonly marketplace: string | null | undefined;
      readonly name: string | null | undefined;
      readonly scope: PluginScope | null | undefined;
    }> | null | undefined;
    readonly projectId: string | null | undefined;
    readonly totalSessions: number | null | undefined;
    readonly worktrees: ReadonlyArray<{
      readonly isWorktree: boolean | null | undefined;
      readonly name: string | null | undefined;
      readonly path: string | null | undefined;
      readonly sessionCount: number | null | undefined;
      readonly subdirs: ReadonlyArray<{
        readonly path: string | null | undefined;
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "path",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionCount",
  "storageKey": null
},
v5 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "Project",
    "kind": "LinkedField",
    "name": "project",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "projectId",
        "storageKey": null
      },
      (v2/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "totalSessions",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "lastActivity",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Worktree",
        "kind": "LinkedField",
        "name": "worktrees",
        "plural": true,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isWorktree",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Subdir",
            "kind": "LinkedField",
            "name": "subdirs",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "relativePath",
                "storageKey": null
              },
              (v3/*: any*/),
              (v4/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Plugin",
        "kind": "LinkedField",
        "name": "plugins",
        "plural": true,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/),
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
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectDetailPageQuery",
    "selections": (v5/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectDetailPageQuery",
    "selections": (v5/*: any*/)
  },
  "params": {
    "cacheID": "d41cb29d894b88f78d587a521645d75a",
    "id": null,
    "metadata": {},
    "name": "ProjectDetailPageQuery",
    "operationKind": "query",
    "text": "query ProjectDetailPageQuery(\n  $id: String!\n) {\n  project(id: $id) {\n    id\n    projectId\n    name\n    totalSessions\n    lastActivity\n    worktrees {\n      name\n      path\n      sessionCount\n      isWorktree\n      subdirs {\n        relativePath\n        path\n        sessionCount\n      }\n    }\n    plugins {\n      id\n      name\n      marketplace\n      scope\n      enabled\n      category\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e3d2085e711810cd4bc812510e148645";

export default node;
