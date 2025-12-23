/**
 * @generated SignedSource<<a128dd2757de9b5727a95a4391426b48>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectsPageQuery$variables = Record<PropertyKey, never>;
export type ProjectsPageQuery$data = {
  readonly viewer: {
    readonly projects: ReadonlyArray<{
      readonly id: string | null | undefined;
      readonly lastActivity: any | null | undefined;
      readonly name: string | null | undefined;
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
    }> | null | undefined;
  } | null | undefined;
};
export type ProjectsPageQuery = {
  response: ProjectsPageQuery$data;
  variables: ProjectsPageQuery$variables;
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
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "path",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionCount",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 100
    }
  ],
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "projects",
  "plural": true,
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "projectId",
      "storageKey": null
    },
    (v1/*: any*/),
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
        (v1/*: any*/),
        (v2/*: any*/),
        (v3/*: any*/),
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
            (v2/*: any*/),
            (v3/*: any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": "projects(first:100)"
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
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
    "name": "ProjectsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v0/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c1d8974ebd75854275f3de4440eb04ee",
    "id": null,
    "metadata": {},
    "name": "ProjectsPageQuery",
    "operationKind": "query",
    "text": "query ProjectsPageQuery {\n  viewer {\n    projects(first: 100) {\n      id\n      projectId\n      name\n      totalSessions\n      lastActivity\n      worktrees {\n        name\n        path\n        sessionCount\n        isWorktree\n        subdirs {\n          relativePath\n          path\n          sessionCount\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "836f403609e378c2addd0d9394e97e5f";

export default node;
