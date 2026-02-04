/**
 * @generated SignedSource<<94b0fe246f76994058c738d1c45585f7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from "relay-runtime";
export type HookRunMessageCard_message$data = {
	readonly cached: boolean | null | undefined;
	readonly directory: string | null | undefined;
	readonly hook: string | null | undefined;
	readonly hookRunId: string | null | undefined;
	readonly id: string | null | undefined;
	readonly plugin: string | null | undefined;
	readonly rawJson: string | null | undefined;
	readonly result:
		| {
				readonly durationMs: number | null | undefined;
				readonly error: string | null | undefined;
				readonly exitCode: number | null | undefined;
				readonly id: string | null | undefined;
				readonly output: string | null | undefined;
				readonly success: boolean | null | undefined;
		  }
		| null
		| undefined;
	readonly timestamp: any | null | undefined;
	readonly " $fragmentType": "HookRunMessageCard_message";
};
export type HookRunMessageCard_message$key = {
	readonly " $data"?: HookRunMessageCard_message$data;
	readonly " $fragmentSpreads": FragmentRefs<"HookRunMessageCard_message">;
};

const node: ReaderFragment = (() => {
	var v0 = {
		alias: null,
		args: null,
		kind: "ScalarField",
		name: "id",
		storageKey: null,
	};
	return {
		argumentDefinitions: [],
		kind: "Fragment",
		metadata: null,
		name: "HookRunMessageCard_message",
		selections: [
			v0 /*: any*/,
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
				name: "cached",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "hookRunId",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				concreteType: "HookResult",
				kind: "LinkedField",
				name: "result",
				plural: false,
				selections: [
					v0 /*: any*/,
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
						name: "durationMs",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "exitCode",
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
				storageKey: null,
			},
		],
		type: "HookRunMessage",
		abstractKey: null,
	};
})();

(node as any).hash = "a09d48a21eba0f572d53a41975d85c29";

export default node;
