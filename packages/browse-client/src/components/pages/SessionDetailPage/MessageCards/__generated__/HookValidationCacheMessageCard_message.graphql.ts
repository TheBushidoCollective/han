/**
 * @generated SignedSource<<04367137681e1667baac959ed78d2962>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from "relay-runtime";
export type HookValidationCacheMessageCard_message$data = {
	readonly directory: string | null | undefined;
	readonly fileCount: number | null | undefined;
	readonly hook: string | null | undefined;
	readonly id: string | null | undefined;
	readonly plugin: string | null | undefined;
	readonly rawJson: string | null | undefined;
	readonly timestamp: any | null | undefined;
	readonly " $fragmentType": "HookValidationCacheMessageCard_message";
};
export type HookValidationCacheMessageCard_message$key = {
	readonly " $data"?: HookValidationCacheMessageCard_message$data;
	readonly " $fragmentSpreads": FragmentRefs<"HookValidationCacheMessageCard_message">;
};

const node: ReaderFragment = {
	argumentDefinitions: [],
	kind: "Fragment",
	metadata: null,
	name: "HookValidationCacheMessageCard_message",
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
			name: "plugin",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "hook",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "directory",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "fileCount",
			storageKey: null,
		},
	],
	type: "HookValidationCacheMessage",
	abstractKey: null,
};

(node as any).hash = "3fef13789977697cb1a1c8507c417ac4";

export default node;
