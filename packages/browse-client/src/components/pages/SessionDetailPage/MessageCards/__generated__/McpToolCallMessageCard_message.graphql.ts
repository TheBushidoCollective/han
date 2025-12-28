/**
 * @generated SignedSource<<71eba6e9016e227ace92b9d0c9b251ab>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from 'relay-runtime';
export type McpToolCallMessageCard_message$data = {
  readonly id: string | null | undefined;
  readonly input: string | null | undefined;
  readonly prefixedName: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly server: string | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly tool: string | null | undefined;
  readonly ' $fragmentType': 'McpToolCallMessageCard_message';
};
export type McpToolCallMessageCard_message$key = {
  readonly ' $data'?: McpToolCallMessageCard_message$data;
  readonly ' $fragmentSpreads': FragmentRefs<'McpToolCallMessageCard_message'>;
};

const node: ReaderFragment = {
  argumentDefinitions: [],
  kind: 'Fragment',
  metadata: null,
  name: 'McpToolCallMessageCard_message',
  selections: [
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'id',
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'timestamp',
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'rawJson',
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'tool',
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'server',
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'prefixedName',
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'input',
      storageKey: null,
    },
  ],
  type: 'McpToolCallMessage',
  abstractKey: null,
};

(node as any).hash = '7856cc41713c3a9c372b4e6b71260000';

export default node;
