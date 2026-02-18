/**
 * @generated SignedSource<<afecedd9653d6c2a8c4e8f7c00782225>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type HookScriptMessageCard_message$data = {
  readonly command: string | null | undefined;
  readonly durationMs: number | null | undefined;
  readonly exitCode: number | null | undefined;
  readonly id: string;
  readonly output: string | null | undefined;
  readonly plugin: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly success: boolean | null | undefined;
  readonly timestamp: string;
  readonly " $fragmentType": "HookScriptMessageCard_message";
};
export type HookScriptMessageCard_message$key = {
  readonly " $data"?: HookScriptMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"HookScriptMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "HookScriptMessageCard_message",
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
      "name": "command",
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
      "name": "exitCode",
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
      "name": "output",
      "storageKey": null
    }
  ],
  "type": "HookScriptMessage",
  "abstractKey": null
};

(node as any).hash = "c93b725fc1ead56285283e9dd76d02ee";

export default node;
