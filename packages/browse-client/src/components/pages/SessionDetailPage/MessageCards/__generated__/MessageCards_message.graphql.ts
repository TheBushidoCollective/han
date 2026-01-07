/**
 * @generated SignedSource<<2fa79c9af68eff92a6cf25f6e35543ea>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type MessageCards_message$data = {
  readonly __typename: string;
  readonly id: string | null | undefined;
  readonly " $fragmentSpreads": FragmentRefs<"AssistantMessageCard_message" | "ExposedToolCallMessageCard_message" | "ExposedToolResultMessageCard_message" | "FileHistorySnapshotMessageCard_message" | "HookDatetimeMessageCard_message" | "HookFileChangeMessageCard_message" | "HookReferenceMessageCard_message" | "HookResultMessageCard_message" | "HookRunMessageCard_message" | "HookScriptMessageCard_message" | "HookValidationCacheMessageCard_message" | "HookValidationMessageCard_message" | "McpToolCallMessageCard_message" | "McpToolResultMessageCard_message" | "MemoryLearnMessageCard_message" | "MemoryQueryMessageCard_message" | "QueueOperationMessageCard_message" | "SentimentAnalysisMessageCard_message" | "SummaryMessageCard_message" | "SystemMessageCard_message" | "UnknownEventMessageCard_message" | "UserMessageCard_message">;
  readonly " $fragmentType": "MessageCards_message";
};
export type MessageCards_message$key = {
  readonly " $data"?: MessageCards_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"MessageCards_message">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "MessageCards_message",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "__typename",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "UserMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "AssistantMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SummaryMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SystemMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "FileHistorySnapshotMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "HookRunMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "HookResultMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "HookReferenceMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "HookValidationMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "HookValidationCacheMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "HookScriptMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "HookDatetimeMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "HookFileChangeMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "QueueOperationMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "McpToolCallMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "McpToolResultMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ExposedToolCallMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ExposedToolResultMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "MemoryQueryMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "MemoryLearnMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SentimentAnalysisMessageCard_message"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "UnknownEventMessageCard_message"
    }
  ],
  "type": "Message",
  "abstractKey": "__isMessage"
};

(node as any).hash = "56661191032ed598ca5df91d1d4b21f7";

export default node;
