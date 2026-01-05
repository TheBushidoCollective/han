/**
 * @generated SignedSource<<aa655d34408d8878f30924a77f980d4c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type HookRunMessageCard_message$data = {
  readonly cached: boolean | null | undefined;
  readonly directory: string | null | undefined;
  readonly hook: string | null | undefined;
  readonly id: string | null | undefined;
  readonly plugin: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly " $fragmentType": "HookRunMessageCard_message";
};
export type HookRunMessageCard_message$key = {
  readonly " $data"?: HookRunMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"HookRunMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "HookRunMessageCard_message",
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
      "name": "plugin",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hook",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "directory",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "cached",
      "storageKey": null
    }
  ],
  "type": "HookRunMessage",
  "abstractKey": null
};

(node as any).hash = "6cee95b71f32a772eb26aea85eaf4b81";

export default node;
