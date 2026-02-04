/**
 * @generated SignedSource<<826ccd77916497e68fd745b600e285ad>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from "relay-runtime";
export type HookFileChangeMessageCard_message$data = {
	readonly changeToolName: string | null | undefined;
	readonly filePath: string | null | undefined;
	readonly id: string | null | undefined;
	readonly rawJson: string | null | undefined;
	readonly recordedSessionId: string | null | undefined;
	readonly timestamp: any | null | undefined;
	readonly " $fragmentType": "HookFileChangeMessageCard_message";
};
export type HookFileChangeMessageCard_message$key = {
	readonly " $data"?: HookFileChangeMessageCard_message$data;
	readonly " $fragmentSpreads": FragmentRefs<"HookFileChangeMessageCard_message">;
};

const node: ReaderFragment = {
	argumentDefinitions: [],
	kind: "Fragment",
	metadata: null,
	name: "HookFileChangeMessageCard_message",
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
			name: "recordedSessionId",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "changeToolName",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "filePath",
			storageKey: null,
		},
	],
	type: "HookFileChangeMessage",
	abstractKey: null,
};

(node as any).hash = "4a43c0653cddcac6c155fee72881a38d";

export default node;
