/**
 * @generated SignedSource<<f1a29243c4cb3a39b8721a4f738fc8ac>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectListPageQuery$variables = Record<PropertyKey, never>;
export type ProjectListPageQuery$data = {
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly lastActivity: string | null | undefined;
    readonly name: string;
    readonly projectId: string;
    readonly repoId: string | null | undefined;
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
  }>;
};
export type ProjectListPageQuery = {
  response: ProjectListPageQuery$data;
  variables: ProjectListPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
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
  "name": "projectId",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "repoId",
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
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectListPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*: any*/),
        "concreteType": "Project",
        "kind": "LinkedField",
        "name": "projects",
        "plural": true,
        "selections": [
          (v1/*: any*/),
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
          }
        ],
        "storageKey": "projects(first:100)"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ProjectListPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*: any*/),
        "concreteType": "Project",
        "kind": "LinkedField",
        "name": "projects",
        "plural": true,
        "selections": [
          (v1/*: any*/),
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
                  (v1/*: any*/)
                ],
                "storageKey": null
              },
              (v1/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": "projects(first:100)"
      }
    ]
  },
  "params": {
    "cacheID": "d22abc485f525933ad7149d4c7520bf4",
    "id": null,
    "metadata": {},
    "name": "ProjectListPageQuery",
    "operationKind": "query",
    "text": "query ProjectListPageQuery {\n  projects(first: 100) {\n    id\n    projectId\n    repoId\n    name\n    totalSessions\n    lastActivity\n    worktrees {\n      name\n      path\n      sessionCount\n      isWorktree\n      subdirs {\n        relativePath\n        path\n        sessionCount\n        id\n      }\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3b56794fbb39fcc0e86e69a6e69c1636";

export default node;
