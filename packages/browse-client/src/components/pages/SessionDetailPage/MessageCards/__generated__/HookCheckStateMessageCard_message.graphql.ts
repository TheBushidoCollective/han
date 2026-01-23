/**
 * @generated SignedSource<<c7ef37418bf8e2b47e2f2c4c5de013e8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type HookCheckStateMessageCard_message$data = {
  readonly fingerprint: string | null | undefined;
  readonly hookType: string | null | undefined;
  readonly hooksCount: number | null | undefined;
  readonly id: string | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly " $fragmentType": "HookCheckStateMessageCard_message";
};
export type HookCheckStateMessageCard_message$key = {
  readonly " $data"?: HookCheckStateMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"HookCheckStateMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "HookCheckStateMessageCard_message",
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
      "name": "hookType",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "fingerprint",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hooksCount",
      "storageKey": null
    }
  ],
  "type": "HookCheckStateMessage",
  "abstractKey": null
};

(node as any).hash = "b84f29607356fcf2a5f74db29314d2e8";

export default node;
