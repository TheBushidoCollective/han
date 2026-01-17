/**
 * @generated SignedSource<<a546b9e5c1bf2b7fe28a31f043f6399e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type FileHistorySnapshotMessageCard_message$data = {
  readonly fileCount: number | null | undefined;
  readonly id: string | null | undefined;
  readonly isSnapshotUpdate: boolean | null | undefined;
  readonly messageId: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly snapshotTimestamp: any | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly " $fragmentType": "FileHistorySnapshotMessageCard_message";
};
export type FileHistorySnapshotMessageCard_message$key = {
  readonly " $data"?: FileHistorySnapshotMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"FileHistorySnapshotMessageCard_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "FileHistorySnapshotMessageCard_message",
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
      "name": "messageId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isSnapshotUpdate",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "fileCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "snapshotTimestamp",
      "storageKey": null
    }
  ],
  "type": "FileHistorySnapshotMessage",
  "abstractKey": null
};

(node as any).hash = "b9852eae6a88e6cb1c8ca371629cce96";

export default node;
