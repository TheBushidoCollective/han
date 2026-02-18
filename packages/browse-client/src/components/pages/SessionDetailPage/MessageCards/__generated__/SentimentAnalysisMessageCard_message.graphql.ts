/**
 * @generated SignedSource<<865fce68cae859b65d912b463c9486a3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SentimentAnalysisMessageCard_message$data = {
  readonly analyzedMessageId: string | null | undefined;
  readonly frustrationLevel: string | null | undefined;
  readonly frustrationScore: number | null | undefined;
  readonly id: string;
  readonly rawJson: string | null | undefined;
  readonly sentimentLevel: string | null | undefined;
  readonly sentimentScore: number | null | undefined;
  readonly signals: ReadonlyArray<string> | null | undefined;
  readonly timestamp: string;
  readonly " $fragmentType": "SentimentAnalysisMessageCard_message";
};
export type SentimentAnalysisMessageCard_message$key = {
  readonly " $data"?: SentimentAnalysisMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"SentimentAnalysisMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SentimentAnalysisMessageCard_message",
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
      "name": "timestamp",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "rawJson",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "sentimentScore",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "sentimentLevel",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "frustrationScore",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "frustrationLevel",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "signals",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "analyzedMessageId",
      "storageKey": null
    }
  ],
  "type": "SentimentAnalysisMessage",
  "abstractKey": null
};

(node as any).hash = "f82cfb559a0b06d10e710310c74456d5";

export default node;
