/**
 * @generated SignedSource<<0da60e0c8710d79bcb57d48bc7cdf82d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DashboardPageActivity_query$data = {
  readonly activity: {
    readonly dailyActivity: ReadonlyArray<{
      readonly cachedTokens: any | null | undefined;
      readonly date: string | null | undefined;
      readonly filesChanged: number | null | undefined;
      readonly inputTokens: any | null | undefined;
      readonly linesAdded: number | null | undefined;
      readonly linesRemoved: number | null | undefined;
      readonly messageCount: number | null | undefined;
      readonly outputTokens: any | null | undefined;
      readonly sessionCount: number | null | undefined;
    }> | null | undefined;
    readonly dailyModelTokens: ReadonlyArray<{
      readonly date: string | null | undefined;
      readonly models: ReadonlyArray<{
        readonly displayName: string | null | undefined;
        readonly model: string | null | undefined;
        readonly tokens: any | null | undefined;
      }> | null | undefined;
      readonly totalTokens: any | null | undefined;
    }> | null | undefined;
    readonly firstSessionDate: string | null | undefined;
    readonly hourlyActivity: ReadonlyArray<{
      readonly hour: number | null | undefined;
      readonly messageCount: number | null | undefined;
      readonly sessionCount: number | null | undefined;
    }> | null | undefined;
    readonly modelUsage: ReadonlyArray<{
      readonly cacheCreationTokens: any | null | undefined;
      readonly cacheReadTokens: any | null | undefined;
      readonly costUsd: number | null | undefined;
      readonly displayName: string | null | undefined;
      readonly inputTokens: any | null | undefined;
      readonly model: string | null | undefined;
      readonly outputTokens: any | null | undefined;
      readonly totalTokens: any | null | undefined;
    }> | null | undefined;
    readonly streakDays: number | null | undefined;
    readonly tokenUsage: {
      readonly estimatedCostUsd: number | null | undefined;
      readonly messageCount: number | null | undefined;
      readonly sessionCount: number | null | undefined;
      readonly totalCachedTokens: any | null | undefined;
      readonly totalInputTokens: any | null | undefined;
      readonly totalOutputTokens: any | null | undefined;
      readonly totalTokens: any | null | undefined;
    } | null | undefined;
    readonly totalActiveDays: number | null | undefined;
    readonly totalMessages: number | null | undefined;
    readonly totalSessions: number | null | undefined;
  } | null | undefined;
  readonly " $fragmentType": "DashboardPageActivity_query";
};
export type DashboardPageActivity_query$key = {
  readonly " $data"?: DashboardPageActivity_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"DashboardPageActivity_query">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "date",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionCount",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messageCount",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "inputTokens",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "outputTokens",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalTokens",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "model",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DashboardPageActivity_query",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "days",
          "value": 730
        }
      ],
      "concreteType": "ActivityData",
      "kind": "LinkedField",
      "name": "activity",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DailyActivity",
          "kind": "LinkedField",
          "name": "dailyActivity",
          "plural": true,
          "selections": [
            (v0/*: any*/),
            (v1/*: any*/),
            (v2/*: any*/),
            (v3/*: any*/),
            (v4/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cachedTokens",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "linesAdded",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "linesRemoved",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "filesChanged",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "HourlyActivity",
          "kind": "LinkedField",
          "name": "hourlyActivity",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hour",
              "storageKey": null
            },
            (v1/*: any*/),
            (v2/*: any*/)
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "TokenUsageStats",
          "kind": "LinkedField",
          "name": "tokenUsage",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "totalInputTokens",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "totalOutputTokens",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "totalCachedTokens",
              "storageKey": null
            },
            (v5/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "estimatedCostUsd",
              "storageKey": null
            },
            (v2/*: any*/),
            (v1/*: any*/)
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "DailyModelTokens",
          "kind": "LinkedField",
          "name": "dailyModelTokens",
          "plural": true,
          "selections": [
            (v0/*: any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": "ModelTokenEntry",
              "kind": "LinkedField",
              "name": "models",
              "plural": true,
              "selections": [
                (v6/*: any*/),
                (v7/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "tokens",
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            (v5/*: any*/)
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "ModelUsageStats",
          "kind": "LinkedField",
          "name": "modelUsage",
          "plural": true,
          "selections": [
            (v6/*: any*/),
            (v7/*: any*/),
            (v3/*: any*/),
            (v4/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cacheReadTokens",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cacheCreationTokens",
              "storageKey": null
            },
            (v5/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "costUsd",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
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
          "name": "totalMessages",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "firstSessionDate",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "streakDays",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalActiveDays",
          "storageKey": null
        }
      ],
      "storageKey": "activity(days:730)"
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "1fe5d2d27adc8a78f80ca329e6a8bf87";

export default node;
