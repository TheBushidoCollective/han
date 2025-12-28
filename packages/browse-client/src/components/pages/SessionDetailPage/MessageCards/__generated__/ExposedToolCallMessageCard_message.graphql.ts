/**
 * @generated SignedSource<<046b786ff3700a1b7e71bb6e13c66abd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from 'relay-runtime';
export type ExposedToolCallMessageCard_message$data = {
  readonly id: string | null | undefined;
  readonly input: string | null | undefined;
  readonly prefixedName: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly tool: string | null | undefined;
  readonly ' $fragmentType': 'ExposedToolCallMessageCard_message';
};
export type ExposedToolCallMessageCard_message$key = {
  readonly ' $data'?: ExposedToolCallMessageCard_message$data;
  readonly ' $fragmentSpreads': FragmentRefs<'ExposedToolCallMessageCard_message'>;
};

const node: ReaderFragment = {
  argumentDefinitions: [],
  kind: 'Fragment',
  metadata: null,
  name: 'ExposedToolCallMessageCard_message',
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
  type: 'ExposedToolCallMessage',
  abstractKey: null,
};

(node as any).hash = '19df6534e14ef2f0a4223c388a281c99';

export default node;
