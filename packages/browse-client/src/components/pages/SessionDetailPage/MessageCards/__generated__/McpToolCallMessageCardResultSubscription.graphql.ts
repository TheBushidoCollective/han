/**
 * @generated SignedSource<<ff49bb26302c63347eda400a2c406330>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type McpToolCallMessageCardResultSubscription$variables = {
	callId: string;
};
export type McpToolCallMessageCardResultSubscription$data = {
	readonly toolResultAdded:
		| {
				readonly callId: string | null | undefined;
				readonly durationMs: number | null | undefined;
				readonly sessionId: string | null | undefined;
				readonly success: boolean | null | undefined;
				readonly type: string | null | undefined;
		  }
		| null
		| undefined;
};
export type McpToolCallMessageCardResultSubscription = {
	response: McpToolCallMessageCardResultSubscription$data;
	variables: McpToolCallMessageCardResultSubscription$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = [
			{
				defaultValue: null,
				kind: "LocalArgument",
				name: "callId",
			},
		],
		v1 = [
			{
				alias: null,
				args: [
					{
						kind: "Variable",
						name: "callId",
						variableName: "callId",
					},
				],
				concreteType: "ToolResultAddedPayload",
				kind: "LinkedField",
				name: "toolResultAdded",
				plural: false,
				selections: [
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "sessionId",
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
						kind: "ScalarField",
						name: "type",
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
						name: "durationMs",
						storageKey: null,
					},
				],
				storageKey: null,
			},
		];
	return {
		fragment: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Fragment",
			metadata: null,
			name: "McpToolCallMessageCardResultSubscription",
			selections: v1 /*: any*/,
			type: "Subscription",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Operation",
			name: "McpToolCallMessageCardResultSubscription",
			selections: v1 /*: any*/,
		},
		params: {
			cacheID: "2e687d254ab05d33208e3649825b44f7",
			id: null,
			metadata: {},
			name: "McpToolCallMessageCardResultSubscription",
			operationKind: "subscription",
			text: "subscription McpToolCallMessageCardResultSubscription(\n  $callId: String!\n) {\n  toolResultAdded(callId: $callId) {\n    sessionId\n    callId\n    type\n    success\n    durationMs\n  }\n}\n",
		},
	};
})();

(node as any).hash = "034fee68080affe92fa2cd4184fd34b3";

export default node;
