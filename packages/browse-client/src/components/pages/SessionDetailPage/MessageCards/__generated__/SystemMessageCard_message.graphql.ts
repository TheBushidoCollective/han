/**
 * @generated SignedSource<<bf9522b06ef65c13695eff231a0554e9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SystemMessageCard_message$data = {
  readonly content: string | null | undefined;
  readonly id: string | null | undefined;
  readonly isMeta: boolean | null | undefined;
  readonly level: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly subtype: string | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly " $fragmentType": "SystemMessageCard_message";
};
export type SystemMessageCard_message$key = {
  readonly " $data"?: SystemMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"SystemMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SystemMessageCard_message",
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
      "name": "subtype",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "level",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isMeta",
      "storageKey": null
    }
  ],
  "type": "SystemMessage",
  "abstractKey": null
};

(node as any).hash = "d3c425024cfbc3e40388cdc7c253a9a6";

export default node;
