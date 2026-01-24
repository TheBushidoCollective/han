/**
 * @generated SignedSource<<c1109915b781ca355aebe7be025adc0f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type EventAction =
  | 'CREATED'
  | 'DELETED'
  | 'UPDATED'
  | '%future added value';
export type MemoryEventType =
  | 'OBSERVATION'
  | 'RELOAD'
  | 'RULE'
  | 'SESSION'
  | 'SUMMARY'
  | '%future added value';
export type DashboardPageSubscription$variables = Record<PropertyKey, never>;
export type DashboardPageSubscription$data = {
  readonly memoryUpdated:
    | {
        readonly action: EventAction | null | undefined;
        readonly path: string | null | undefined;
        readonly timestamp: string | null | undefined;
        readonly type: MemoryEventType | null | undefined;
      }
    | null
    | undefined;
};
export type DashboardPageSubscription = {
  response: DashboardPageSubscription$data;
  variables: DashboardPageSubscription$variables;
};

const node: ConcreteRequest = (() => {
  var v0 = [
    {
      alias: null,
      args: null,
      concreteType: 'MemoryEvent',
      kind: 'LinkedField',
      name: 'memoryUpdated',
      plural: false,
      selections: [
        {
          alias: null,
          args: null,
          kind: 'ScalarField',
          name: 'type',
          storageKey: null,
        },
        {
          alias: null,
          args: null,
          kind: 'ScalarField',
          name: 'action',
          storageKey: null,
        },
        {
          alias: null,
          args: null,
          kind: 'ScalarField',
          name: 'path',
          storageKey: null,
        },
        {
          alias: null,
          args: null,
          kind: 'ScalarField',
          name: 'timestamp',
          storageKey: null,
        },
      ],
      storageKey: null,
    },
  ];
  return {
    fragment: {
      argumentDefinitions: [],
      kind: 'Fragment',
      metadata: null,
      name: 'DashboardPageSubscription',
      selections: v0 /*: any*/,
      type: 'Subscription',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: [],
      kind: 'Operation',
      name: 'DashboardPageSubscription',
      selections: v0 /*: any*/,
    },
    params: {
      cacheID: 'e5cf45abb0ffff5881d968fc806a52c5',
      id: null,
      metadata: {},
      name: 'DashboardPageSubscription',
      operationKind: 'subscription',
      text: 'subscription DashboardPageSubscription {\n  memoryUpdated {\n    type\n    action\n    path\n    timestamp\n  }\n}\n',
    },
  };
})();

(node as any).hash = 'b7c56fb248ba9bee0682763f704801e7';

export default node;
