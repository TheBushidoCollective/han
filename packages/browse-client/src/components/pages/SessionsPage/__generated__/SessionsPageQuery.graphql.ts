/**
 * @generated SignedSource<<0865aeee03a5c519f76e8b7ab333e0f6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionsPageQuery$variables = {
  first?: number | null | undefined;
  projectId?: string | null | undefined;
  worktreeName?: string | null | undefined;
};
export type SessionsPageQuery$data = {
  readonly sessionsConnection: {
    readonly edges: ReadonlyArray<{
      readonly cursor: string | null | undefined;
      readonly node: {
        readonly date: string | null | undefined;
        readonly endedAt: any | null | undefined;
        readonly gitBranch: string | null | undefined;
        readonly id: string | null | undefined;
        readonly messageCount: number | null | undefined;
        readonly projectName: string | null | undefined;
        readonly projectPath: string | null | undefined;
        readonly sessionId: string | null | undefined;
        readonly startedAt: any | null | undefined;
        readonly summary: string | null | undefined;
        readonly version: string | null | undefined;
        readonly worktreeName: string | null | undefined;
      } | null | undefined;
    }> | null | undefined;
    readonly pageInfo: {
      readonly endCursor: string | null | undefined;
      readonly hasNextPage: boolean | null | undefined;
      readonly hasPreviousPage: boolean | null | undefined;
      readonly startCursor: string | null | undefined;
    } | null | undefined;
    readonly totalCount: number | null | undefined;
  } | null | undefined;
};
export type SessionsPageQuery = {
  response: SessionsPageQuery$data;
  variables: SessionsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "worktreeName"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "first"
      },
      {
        "kind": "Variable",
        "name": "projectId",
        "variableName": "projectId"
      },
      {
        "kind": "Variable",
        "name": "worktreeName",
        "variableName": "worktreeName"
      }
    ],
    "concreteType": "SessionConnection",
    "kind": "LinkedField",
    "name": "sessionsConnection",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SessionEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Session",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
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
                "name": "sessionId",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "date",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "projectName",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "projectPath",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "worktreeName",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "summary",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "messageCount",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "startedAt",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endedAt",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "gitBranch",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "version",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "cursor",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "PageInfo",
        "kind": "LinkedField",
        "name": "pageInfo",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "hasNextPage",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "hasPreviousPage",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "startCursor",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "endCursor",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "totalCount",
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
    "name": "SessionsPageQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SessionsPageQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "efd8741b89127c7f7aeef3ff39359d1f",
    "id": null,
    "metadata": {},
    "name": "SessionsPageQuery",
    "operationKind": "query",
    "text": "query SessionsPageQuery(\n  $first: Int\n  $projectId: String\n  $worktreeName: String\n) {\n  sessionsConnection(first: $first, projectId: $projectId, worktreeName: $worktreeName) {\n    edges {\n      node {\n        id\n        sessionId\n        date\n        projectName\n        projectPath\n        worktreeName\n        summary\n        messageCount\n        startedAt\n        endedAt\n        gitBranch\n        version\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n    totalCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "9d24afe31b6e6207639115bc138bbdf9";

export default node;
