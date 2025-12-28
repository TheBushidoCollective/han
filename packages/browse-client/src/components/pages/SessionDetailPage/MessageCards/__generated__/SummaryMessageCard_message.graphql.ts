/**
 * @generated SignedSource<<1e571e363f087a8dacf575287011af39>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from 'relay-runtime';
export type SummaryMessageCard_message$data = {
  readonly content: string | null | undefined;
  readonly id: string | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly timestamp: any | null | undefined;
  readonly ' $fragmentType': 'SummaryMessageCard_message';
};
export type SummaryMessageCard_message$key = {
  readonly ' $data'?: SummaryMessageCard_message$data;
  readonly ' $fragmentSpreads': FragmentRefs<'SummaryMessageCard_message'>;
};

const node: ReaderFragment = {
  argumentDefinitions: [],
  kind: 'Fragment',
  metadata: null,
  name: 'SummaryMessageCard_message',
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
      name: 'content',
      storageKey: null,
    },
  ],
  type: 'SummaryMessage',
  abstractKey: null,
};

(node as any).hash = 'd35ce8e6e3d19be6c570f28517173ba2';

export default node;
