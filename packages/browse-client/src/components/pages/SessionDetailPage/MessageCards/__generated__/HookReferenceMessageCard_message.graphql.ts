/**
 * @generated SignedSource<<260130ad02e6509f2dce45d9292eb093>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type HookReferenceMessageCard_message$data = {
  readonly durationMs: number | null | undefined;
  readonly filePath: string | null | undefined;
  readonly id: string | null | undefined;
  readonly plugin: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly reason: string | null | undefined;
  readonly success: boolean | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly " $fragmentType": "HookReferenceMessageCard_message";
};
export type HookReferenceMessageCard_message$key = {
  readonly " $data"?: HookReferenceMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"HookReferenceMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "HookReferenceMessageCard_message",
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
      "name": "filePath",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "reason",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "success",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "durationMs",
      "storageKey": null
    }
  ],
  "type": "HookReferenceMessage",
  "abstractKey": null
};

(node as any).hash = "c618b3aeb764c753ee83d4e3383a9d92";

export default node;
