/**
 * @generated SignedSource<<26b3a3e910bde9f186e50667b35dd486>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type FileChangeAction = "CREATED" | "DELETED" | "MODIFIED" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type SessionSidebar_fileChanges$data = {
  readonly fileChangeCount: number | null | undefined;
  readonly fileChanges: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly action: FileChangeAction | null | undefined;
        readonly filePath: string | null | undefined;
        readonly id: string | null | undefined;
        readonly isValidated: boolean | null | undefined;
        readonly missingValidations: ReadonlyArray<{
          readonly hookName: string | null | undefined;
          readonly pluginName: string | null | undefined;
        }> | null | undefined;
        readonly recordedAt: any | null | undefined;
        readonly toolName: string | null | undefined;
        readonly validations: ReadonlyArray<{
          readonly hookName: string | null | undefined;
          readonly pluginName: string | null | undefined;
          readonly validatedAt: any | null | undefined;
        }> | null | undefined;
      } | null | undefined;
    }> | null | undefined;
    readonly pageInfo: {
      readonly endCursor: string | null | undefined;
      readonly hasNextPage: boolean | null | undefined;
    } | null | undefined;
    readonly totalCount: number | null | undefined;
  } | null | undefined;
  readonly id: string;
  readonly " $fragmentType": "SessionSidebar_fileChanges";
};
export type SessionSidebar_fileChanges$key = {
  readonly " $data"?: SessionSidebar_fileChanges$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionSidebar_fileChanges">;
};

import SessionSidebarFilesRefetchQuery_graphql from './SessionSidebarFilesRefetchQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "fileChanges"
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
  "name": "pluginName",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "hookName",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 50,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": SessionSidebarFilesRefetchQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "SessionSidebar_fileChanges",
  "selections": [
    {
      "alias": "fileChanges",
      "args": null,
      "concreteType": "FileChangeConnection",
      "kind": "LinkedField",
      "name": "__SessionSidebar_fileChanges_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "FileChangeEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "FileChange",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "filePath",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "action",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "toolName",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "recordedAt",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "isValidated",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "FileValidation",
                  "kind": "LinkedField",
                  "name": "validations",
                  "plural": true,
                  "selections": [
                    (v2/*: any*/),
                    (v3/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "validatedAt",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "FileValidation",
                  "kind": "LinkedField",
                  "name": "missingValidations",
                  "plural": true,
                  "selections": [
                    (v2/*: any*/),
                    (v3/*: any*/)
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
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
              "name": "endCursor",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "fileChangeCount",
      "storageKey": null
    },
    (v1/*: any*/)
  ],
  "type": "Session",
  "abstractKey": null
};
})();

(node as any).hash = "10f6f88bc40e37d960a637f1f32704ef";

export default node;
