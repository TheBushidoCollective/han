/**
 * @generated SignedSource<<9846a894d5d00696186b43c6ddc43c46>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UnknownEventMessageCard_message$data = {
  readonly eventType: string | null | undefined;
  readonly id: string;
  readonly messageType: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly timestamp: string;
  readonly " $fragmentType": "UnknownEventMessageCard_message";
};
export type UnknownEventMessageCard_message$key = {
  readonly " $data"?: UnknownEventMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"UnknownEventMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "UnknownEventMessageCard_message",
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
      "name": "messageType",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "eventType",
      "storageKey": null
    }
  ],
  "type": "UnknownEventMessage",
  "abstractKey": null
};

(node as any).hash = "b8fd65675faeb6644622ceda9e6ecb68";

export default node;
