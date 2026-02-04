/**
 * @generated SignedSource<<f8e0b95d20b74009c134dff9a80f9a3d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from "relay-runtime";
export type McpToolResultMessageCard_message$data = {
	readonly durationMs: number | null | undefined;
	readonly error: string | null | undefined;
	readonly id: string | null | undefined;
	readonly output: string | null | undefined;
	readonly prefixedName: string | null | undefined;
	readonly rawJson: string | null | undefined;
	readonly server: string | null | undefined;
	readonly success: boolean | null | undefined;
	readonly timestamp: any | null | undefined;
	readonly tool: string | null | undefined;
	readonly " $fragmentType": "McpToolResultMessageCard_message";
};
export type McpToolResultMessageCard_message$key = {
	readonly " $data"?: McpToolResultMessageCard_message$data;
	readonly " $fragmentSpreads": FragmentRefs<"McpToolResultMessageCard_message">;
};

const node: ReaderFragment = {
	argumentDefinitions: [],
	kind: "Fragment",
	metadata: null,
	name: "McpToolResultMessageCard_message",
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
			name: "server",
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
	type: "McpToolResultMessage",
	abstractKey: null,
};

(node as any).hash = "671dcf758a2f6bece72839cdfd310f01";

export default node;
