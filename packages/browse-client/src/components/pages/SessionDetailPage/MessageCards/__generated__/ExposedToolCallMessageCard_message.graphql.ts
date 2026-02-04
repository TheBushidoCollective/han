/**
 * @generated SignedSource<<ef29e70bc3114e610573de7b7b83782c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { FragmentRefs, ReaderFragment } from "relay-runtime";
export type ExposedToolCallMessageCard_message$data = {
	readonly callId: string | null | undefined;
	readonly id: string | null | undefined;
	readonly input: string | null | undefined;
	readonly prefixedName: string | null | undefined;
	readonly rawJson: string | null | undefined;
	readonly result:
		| {
				readonly durationMs: number | null | undefined;
				readonly error: string | null | undefined;
				readonly id: string | null | undefined;
				readonly result: string | null | undefined;
				readonly success: boolean | null | undefined;
		  }
		| null
		| undefined;
	readonly timestamp: any | null | undefined;
	readonly tool: string | null | undefined;
	readonly " $fragmentType": "ExposedToolCallMessageCard_message";
};
export type ExposedToolCallMessageCard_message$key = {
	readonly " $data"?: ExposedToolCallMessageCard_message$data;
	readonly " $fragmentSpreads": FragmentRefs<"ExposedToolCallMessageCard_message">;
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
		name: "ExposedToolCallMessageCard_message",
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
				name: "input",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "callId",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				concreteType: "ExposedToolResult",
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
						name: "result",
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
		type: "ExposedToolCallMessage",
		abstractKey: null,
	};
})();

(node as any).hash = "b448461b77a99d881da300e52cd31bb7";

export default node;
