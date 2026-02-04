/**
 * @generated SignedSource<<6cad4b33ce9603acd1e999229d1ccd21>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SummaryMessageCard_message$data = {
  readonly content: string | null | undefined;
  readonly id: string | null | undefined;
  readonly isCompactSummary: boolean | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly " $fragmentType": "SummaryMessageCard_message";
};
export type SummaryMessageCard_message$key = {
  readonly " $data"?: SummaryMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"SummaryMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SummaryMessageCard_message",
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
      "name": "content",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isCompactSummary",
      "storageKey": null
    }
  ],
  "type": "SummaryMessage",
  "abstractKey": null
};

(node as any).hash = "5132960e1a1edfe9e850514caeca68b7";

export default node;
