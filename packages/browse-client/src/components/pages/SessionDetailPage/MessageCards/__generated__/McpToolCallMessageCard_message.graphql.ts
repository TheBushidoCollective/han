/**
 * @generated SignedSource<<fdbf24d4bd3270198891bdc3543af073>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from 'relay-runtime';
export type McpToolCallMessageCard_message$data = {
  readonly callId: string | null | undefined;
  readonly id: string | null | undefined;
  readonly input: string | null | undefined;
  readonly prefixedName: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly result:
    | {
        readonly durationMs: number | null | undefined;
        readonly error: string | null | undefined;
        readonly id: string | null | undefined;
        readonly result: string | null | undefined;
        readonly success: boolean | null | undefined;
      }
    | null
    | undefined;
  readonly server: string | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly tool: string | null | undefined;
  readonly ' $fragmentType': 'McpToolCallMessageCard_message';
};
export type McpToolCallMessageCard_message$key = {
  readonly ' $data'?: McpToolCallMessageCard_message$data;
  readonly ' $fragmentSpreads': FragmentRefs<'McpToolCallMessageCard_message'>;
};

const node: ReaderFragment = (() => {
  var v0 = {
    alias: null,
    args: null,
    kind: 'ScalarField',
    name: 'id',
    storageKey: null,
  };
  return {
    argumentDefinitions: [],
    kind: 'Fragment',
    metadata: null,
    name: 'McpToolCallMessageCard_message',
    selections: [
      v0 /*: any*/,
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
      {
        alias: null,
        args: null,
        kind: 'ScalarField',
        name: 'callId',
        storageKey: null,
      },
      {
        alias: null,
        args: null,
        concreteType: 'McpToolResult',
        kind: 'LinkedField',
        name: 'result',
        plural: false,
        selections: [
          v0 /*: any*/,
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'success',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'durationMs',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'result',
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: 'ScalarField',
            name: 'error',
            storageKey: null,
          },
        ],
        storageKey: null,
      },
    ],
    type: 'McpToolCallMessage',
    abstractKey: null,
  };
})();

(node as any).hash = 'cb76c71789e4624bde5ac06c22ef048d';

export default node;
