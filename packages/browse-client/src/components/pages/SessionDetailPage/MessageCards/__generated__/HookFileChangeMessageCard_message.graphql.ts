/**
 * @generated SignedSource<<061a8abe75ee3a8dd457e4be757407fd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type HookFileChangeMessageCard_message$data = {
  readonly changeToolName: string | null | undefined;
  readonly filePath: string | null | undefined;
  readonly id: string;
  readonly rawJson: string | null | undefined;
  readonly recordedSessionId: string | null | undefined;
  readonly timestamp: string;
  readonly " $fragmentType": "HookFileChangeMessageCard_message";
};
export type HookFileChangeMessageCard_message$key = {
  readonly " $data"?: HookFileChangeMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"HookFileChangeMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "HookFileChangeMessageCard_message",
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
      "name": "recordedSessionId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "changeToolName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "filePath",
      "storageKey": null
    }
  ],
  "type": "HookFileChangeMessage",
  "abstractKey": null
};

(node as any).hash = "4a43c0653cddcac6c155fee72881a38d";

export default node;
