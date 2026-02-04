/**
 * @generated SignedSource<<d2d22e1084dbb9cf62c8f00c9d65f1d0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from "relay-runtime";
export type ExposedToolResultMessageCard_message$data = {
	readonly durationMs: number | null | undefined;
	readonly error: string | null | undefined;
	readonly id: string | null | undefined;
	readonly output: string | null | undefined;
	readonly prefixedName: string | null | undefined;
	readonly rawJson: string | null | undefined;
	readonly success: boolean | null | undefined;
	readonly timestamp: any | null | undefined;
	readonly tool: string | null | undefined;
	readonly " $fragmentType": "ExposedToolResultMessageCard_message";
};
export type ExposedToolResultMessageCard_message$key = {
	readonly " $data"?: ExposedToolResultMessageCard_message$data;
	readonly " $fragmentSpreads": FragmentRefs<"ExposedToolResultMessageCard_message">;
};

const node: ReaderFragment = {
	argumentDefinitions: [],
	kind: "Fragment",
	metadata: null,
	name: "ExposedToolResultMessageCard_message",
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
			name: "tool",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "prefixedName",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "durationMs",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "success",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "output",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "error",
			storageKey: null,
		},
	],
	type: "ExposedToolResultMessage",
	abstractKey: null,
};

(node as any).hash = "6a2fb9de736df15a883f9cded5edb11b";

export default node;
