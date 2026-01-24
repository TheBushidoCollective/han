/**
 * @generated SignedSource<<71b4fe2573db867594274d5dd61788bf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type HookValidationMessageCard_message$data = {
  readonly cached: boolean | null | undefined;
  readonly directory: string | null | undefined;
  readonly durationMs: number | null | undefined;
  readonly error: string | null | undefined;
  readonly exitCode: number | null | undefined;
  readonly hook: string | null | undefined;
  readonly id: string | null | undefined;
  readonly output: string | null | undefined;
  readonly plugin: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly success: boolean | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly " $fragmentType": "HookValidationMessageCard_message";
};
export type HookValidationMessageCard_message$key = {
  readonly " $data"?: HookValidationMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"HookValidationMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "HookValidationMessageCard_message",
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
  "type": "HookValidationMessage",
  "abstractKey": null
};

(node as any).hash = "5d2bd8a4d3605145b451225c8d94bcf4";

export default node;
