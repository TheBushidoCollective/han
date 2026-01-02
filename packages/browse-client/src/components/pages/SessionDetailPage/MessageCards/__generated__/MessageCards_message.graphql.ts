/**
 * @generated SignedSource<<9fce6bb1f4a1dc6aa8288b94c5fc509b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from 'relay-runtime';
export type MessageCards_message$data = {
  readonly __typename: string;
  readonly ' $fragmentSpreads': FragmentRefs<
    | 'AssistantMessageCard_message'
    | 'ExposedToolCallMessageCard_message'
    | 'ExposedToolResultMessageCard_message'
    | 'FileHistorySnapshotMessageCard_message'
    | 'HookResultMessageCard_message'
    | 'HookRunMessageCard_message'
    | 'McpToolCallMessageCard_message'
    | 'McpToolResultMessageCard_message'
    | 'MemoryLearnMessageCard_message'
    | 'MemoryQueryMessageCard_message'
    | 'QueueOperationMessageCard_message'
    | 'SentimentAnalysisMessageCard_message'
    | 'SummaryMessageCard_message'
    | 'SystemMessageCard_message'
    | 'UnknownEventMessageCard_message'
    | 'UserMessageCard_message'
  >;
  readonly ' $fragmentType': 'MessageCards_message';
};
export type MessageCards_message$key = {
  readonly ' $data'?: MessageCards_message$data;
  readonly ' $fragmentSpreads': FragmentRefs<'MessageCards_message'>;
};

const node: ReaderFragment = {
  argumentDefinitions: [],
  kind: 'Fragment',
  metadata: null,
  name: 'MessageCards_message',
  selections: [
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: '__typename',
      storageKey: null,
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'UserMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'AssistantMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'SummaryMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'SystemMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'FileHistorySnapshotMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'HookRunMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'HookResultMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'QueueOperationMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'McpToolCallMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'McpToolResultMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'ExposedToolCallMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'ExposedToolResultMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'MemoryQueryMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'MemoryLearnMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'SentimentAnalysisMessageCard_message',
    },
    {
      args: null,
      kind: 'FragmentSpread',
      name: 'UnknownEventMessageCard_message',
    },
  ],
  type: 'Message',
  abstractKey: '__isMessage',
};

(node as any).hash = 'e8ed29ae0a6b4e74d3c769defb498a1b';

export default node;
