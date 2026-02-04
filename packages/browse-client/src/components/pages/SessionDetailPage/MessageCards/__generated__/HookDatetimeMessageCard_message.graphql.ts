/**
 * @generated SignedSource<<8fa3d9777d4abc29e77e6fde4b3425ae>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from "relay-runtime";
export type HookDatetimeMessageCard_message$data = {
	readonly datetime: string | null | undefined;
	readonly durationMs: number | null | undefined;
	readonly id: string | null | undefined;
	readonly plugin: string | null | undefined;
	readonly rawJson: string | null | undefined;
	readonly timestamp: any | null | undefined;
	readonly " $fragmentType": "HookDatetimeMessageCard_message";
};
export type HookDatetimeMessageCard_message$key = {
	readonly " $data"?: HookDatetimeMessageCard_message$data;
	readonly " $fragmentSpreads": FragmentRefs<"HookDatetimeMessageCard_message">;
};

const node: ReaderFragment = {
	argumentDefinitions: [],
	kind: "Fragment",
	metadata: null,
	name: "HookDatetimeMessageCard_message",
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
			name: "datetime",
			storageKey: null,
		},
		{
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "durationMs",
			storageKey: null,
		},
	],
	type: "HookDatetimeMessage",
	abstractKey: null,
};

(node as any).hash = "6f80e94c5bb4f2479aa8c1744ea1d6a2";

export default node;
