/**
 * @generated SignedSource<<5859b9724629fbc521a64abc8f98537e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type MemoryLearnMessageCard_message$data = {
  readonly append: boolean | null | undefined;
  readonly domain: string | null | undefined;
  readonly id: string;
  readonly paths: ReadonlyArray<string> | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly scope: string | null | undefined;
  readonly timestamp: string;
  readonly " $fragmentType": "MemoryLearnMessageCard_message";
};
export type MemoryLearnMessageCard_message$key = {
  readonly " $data"?: MemoryLearnMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"MemoryLearnMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "MemoryLearnMessageCard_message",
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
      "name": "domain",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "scope",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "paths",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "append",
      "storageKey": null
    }
  ],
  "type": "MemoryLearnMessage",
  "abstractKey": null
};

(node as any).hash = "da488cbea5054ec7ca456244e98f7e90";

export default node;
