/**
 * @generated SignedSource<<609cc9dd80a1e8c4bde4f14d3a15e170>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type OverviewTab_session$data = {
  readonly compactionCount: number | null | undefined;
  readonly duration: number | null | undefined;
  readonly estimatedCostUsd: number | null | undefined;
  readonly fileChangeCount: number | null | undefined;
  readonly frustrationSummary: {
    readonly averageScore: number | null | undefined;
    readonly highCount: number | null | undefined;
    readonly moderateCount: number | null | undefined;
    readonly overallLevel: string | null | undefined;
    readonly peakScore: number | null | undefined;
    readonly topSignals: ReadonlyArray<string> | null | undefined;
    readonly totalAnalyzed: number | null | undefined;
  } | null | undefined;
  readonly hookStats: {
    readonly byHookType: ReadonlyArray<{
      readonly hookType: string | null | undefined;
      readonly passed: number | null | undefined;
      readonly total: number | null | undefined;
    }> | null | undefined;
    readonly failedHooks: number | null | undefined;
    readonly passRate: number | null | undefined;
    readonly passedHooks: number | null | undefined;
    readonly totalDurationMs: number | null | undefined;
    readonly totalHooks: number | null | undefined;
  } | null | undefined;
  readonly messageCount: number;
  readonly nativeTasks: ReadonlyArray<{
    readonly activeForm: string | null | undefined;
    readonly id: string;
    readonly status: string;
    readonly subject: string;
  }>;
  readonly startedAt: string | null | undefined;
  readonly status: string | null | undefined;
  readonly todoCounts: {
    readonly completed: number | null | undefined;
    readonly inProgress: number | null | undefined;
    readonly pending: number | null | undefined;
    readonly total: number | null | undefined;
  } | null | undefined;
  readonly turnCount: number | null | undefined;
  readonly updatedAt: string | null | undefined;
  readonly version: string | null | undefined;
  readonly " $fragmentType": "OverviewTab_session";
};
export type OverviewTab_session$key = {
  readonly " $data"?: OverviewTab_session$data;
  readonly " $fragmentSpreads": FragmentRefs<"OverviewTab_session">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "total",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "OverviewTab_session",
  "selections": [
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
      "name": "turnCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "duration",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "estimatedCostUsd",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "compactionCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "version",
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
      "name": "updatedAt",
      "storageKey": null
    },
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "HookStats",
      "kind": "LinkedField",
      "name": "hookStats",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalHooks",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "passedHooks",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "failedHooks",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalDurationMs",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "passRate",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "HookTypeStat",
          "kind": "LinkedField",
          "name": "byHookType",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hookType",
              "storageKey": null
            },
            (v1/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "passed",
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
      "concreteType": "FrustrationSummary",
      "kind": "LinkedField",
      "name": "frustrationSummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalAnalyzed",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "moderateCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "highCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "overallLevel",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "averageScore",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "peakScore",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "topSignals",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "TodoCounts",
      "kind": "LinkedField",
      "name": "todoCounts",
      "plural": false,
      "selections": [
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "pending",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "inProgress",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "completed",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "NativeTask",
      "kind": "LinkedField",
      "name": "nativeTasks",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "id",
          "storageKey": null
        },
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "subject",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "activeForm",
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
    }
  ],
  "type": "Session",
  "abstractKey": null
};
})();

(node as any).hash = "1ee202129462bb18a4e36f3b5525d800";

export default node;
