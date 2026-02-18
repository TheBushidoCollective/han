/**
 * @generated SignedSource<<a8c74d4cc631d5cb657e7b6787a8cfd4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RepoDetailPageQuery$variables = {
  id: string;
};
export type RepoDetailPageQuery$data = {
  readonly repo: {
    readonly id: string;
    readonly lastActivity: string | null | undefined;
    readonly name: string;
    readonly path: string;
    readonly projects: ReadonlyArray<{
      readonly id: string;
      readonly lastActivity: string | null | undefined;
      readonly name: string;
      readonly projectId: string;
      readonly totalSessions: number | null | undefined;
      readonly worktrees: ReadonlyArray<{
        readonly isWorktree: boolean;
        readonly name: string;
        readonly path: string;
        readonly sessionCount: number | null | undefined;
      }> | null | undefined;
    }> | null | undefined;
    readonly repoId: string;
    readonly totalSessions: number | null | undefined;
  } | null | undefined;
};
export type RepoDetailPageQuery = {
  response: RepoDetailPageQuery$data;
  variables: RepoDetailPageQuery$variables;
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
  "name": "path",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalSessions",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lastActivity",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectId",
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
  "name": "sessionCount",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RepoDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Repo",
        "kind": "LinkedField",
        "name": "repo",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Project",
            "kind": "LinkedField",
            "name": "projects",
            "plural": true,
            "selections": [
              (v2/*: any*/),
              (v8/*: any*/),
              (v4/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "worktrees",
                "plural": true,
                "selections": [
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
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
    "name": "RepoDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Repo",
        "kind": "LinkedField",
        "name": "repo",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Project",
            "kind": "LinkedField",
            "name": "projects",
            "plural": true,
            "selections": [
              (v2/*: any*/),
              (v8/*: any*/),
              (v4/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "worktrees",
                "plural": true,
                "selections": [
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v2/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "6c21e4e21d015f03c64fb492a544a943",
    "id": null,
    "metadata": {},
    "name": "RepoDetailPageQuery",
    "operationKind": "query",
    "text": "query RepoDetailPageQuery(\n  $id: String!\n) {\n  repo(id: $id) {\n    id\n    repoId\n    name\n    path\n    totalSessions\n    lastActivity\n    projects {\n      id\n      projectId\n      name\n      totalSessions\n      lastActivity\n      worktrees {\n        name\n        path\n        isWorktree\n        sessionCount\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8e05a981effd7f4a38c210c61edac5ef";

export default node;
