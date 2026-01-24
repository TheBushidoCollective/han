/**
 * @generated SignedSource<<5568f79b5de806180660a860d008cd77>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type MemoryQueryMessageCard_message$data = {
  readonly durationMs: number | null | undefined;
  readonly id: string | null | undefined;
  readonly question: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly resultCount: number | null | undefined;
  readonly route: string | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly " $fragmentType": "MemoryQueryMessageCard_message";
};
export type MemoryQueryMessageCard_message$key = {
  readonly " $data"?: MemoryQueryMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"MemoryQueryMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "MemoryQueryMessageCard_message",
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
      "name": "question",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "route",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "durationMs",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "resultCount",
      "storageKey": null
    }
  ],
  "type": "MemoryQueryMessage",
  "abstractKey": null
};

(node as any).hash = "8ff4654e0ba4b20c3074deefc3d4294b";

export default node;
