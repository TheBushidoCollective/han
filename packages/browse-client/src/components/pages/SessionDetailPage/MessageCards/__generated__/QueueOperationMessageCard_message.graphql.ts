/**
 * @generated SignedSource<<21b54208a4f4b6b808026cc7324b377d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from "relay-runtime";
export type QueueOperationMessageCard_message$data = {
	readonly id: string | null | undefined;
	readonly operation: string | null | undefined;
	readonly queueSessionId: string | null | undefined;
	readonly rawJson: string | null | undefined;
	readonly timestamp: any | null | undefined;
	readonly " $fragmentType": "QueueOperationMessageCard_message";
};
export type QueueOperationMessageCard_message$key = {
	readonly " $data"?: QueueOperationMessageCard_message$data;
	readonly " $fragmentSpreads": FragmentRefs<"QueueOperationMessageCard_message">;
};

const node: ReaderFragment = {
	argumentDefinitions: [],
	kind: "Fragment",
	metadata: null,
	name: "QueueOperationMessageCard_message",
	selections: [
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "id",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "timestamp",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "rawJson",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "operation",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "queueSessionId",
			storageKey: null,
		},
	],
	type: "QueueOperationMessage",
	abstractKey: null,
};

(node as any).hash = "570a26253a136dd05c328fda504482e8";

export default node;
