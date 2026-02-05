/**
 * @generated SignedSource<<eb1fbc43cab4a23a04b243b605bf3be7>>
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
  readonly rawJson: string | null | undefined;
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
      "name": "rawJson",
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

(node as any).hash = "53e32e036c170125e31842710345d0bf";

export default node;
