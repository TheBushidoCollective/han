/**
 * @generated SignedSource<<a3548e84b6eb7f33bed7b69854aef208>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type HookResultMessageCard_message$data = {
  readonly cached: boolean | null | undefined;
  readonly directory: string | null | undefined;
  readonly durationMs: number | null | undefined;
  readonly error: string | null | undefined;
  readonly exitCode: number | null | undefined;
  readonly hook: string | null | undefined;
  readonly id: string;
  readonly output: string | null | undefined;
  readonly plugin: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly success: boolean | null | undefined;
  readonly timestamp: string;
  readonly " $fragmentType": "HookResultMessageCard_message";
};
export type HookResultMessageCard_message$key = {
  readonly " $data"?: HookResultMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"HookResultMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "HookResultMessageCard_message",
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "error",
      "storageKey": null
    }
  ],
  "type": "HookResultMessage",
  "abstractKey": null
};

(node as any).hash = "0f669bc2791009e2a2339bb50db44d2e";

export default node;
