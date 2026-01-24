/**
 * @generated SignedSource<<215e44dc20f5f03d1f8d717a909aa61d>>
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
    readonly id: string | null | undefined;
    readonly lastActivity: any | null | undefined;
    readonly name: string | null | undefined;
    readonly projectId: string | null | undefined;
    readonly repoId: string | null | undefined;
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
};
export type ProjectListPageQuery = {
  response: ProjectListPageQuery$data;
  variables: ProjectListPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "path",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionCount",
  "storageKey": null
},
v3 = [
  {
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
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "projectId",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "repoId",
        "storageKey": null
      },
      (v0/*: any*/),
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
          (v0/*: any*/),
          (v1/*: any*/),
          (v2/*: any*/),
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
              (v1/*: any*/),
              (v2/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "projects(first:100)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectListPageQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ProjectListPageQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "857148600c5fb4c0932792ed4c97a4ce",
    "id": null,
    "metadata": {},
    "name": "ProjectListPageQuery",
    "operationKind": "query",
    "text": "query ProjectListPageQuery {\n  projects(first: 100) {\n    id\n    projectId\n    repoId\n    name\n    totalSessions\n    lastActivity\n    worktrees {\n      name\n      path\n      sessionCount\n      isWorktree\n      subdirs {\n        relativePath\n        path\n        sessionCount\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3b56794fbb39fcc0e86e69a6e69c1636";

export default node;
