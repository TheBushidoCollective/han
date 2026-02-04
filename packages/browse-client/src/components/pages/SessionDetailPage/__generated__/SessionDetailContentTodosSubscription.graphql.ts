/**
 * @generated SignedSource<<c380d03cca9f2322d188c6624b1a615a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type SessionDetailContentTodosSubscription$variables = {
	sessionId: string;
};
export type SessionDetailContentTodosSubscription$data = {
	readonly sessionTodosChanged:
		| {
				readonly completedCount: number | null | undefined;
				readonly inProgressCount: number | null | undefined;
				readonly sessionId: string | null | undefined;
				readonly todoCount: number | null | undefined;
		  }
		| null
		| undefined;
};
export type SessionDetailContentTodosSubscription = {
	response: SessionDetailContentTodosSubscription$data;
	variables: SessionDetailContentTodosSubscription$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = [
			{
				defaultValue: null,
				kind: "LocalArgument",
				name: "sessionId",
			},
		],
		v1 = [
			{
				alias: null,
				args: [
					{
						kind: "Variable",
						name: "sessionId",
						variableName: "sessionId",
					},
				],
				concreteType: "SessionTodosChangedPayload",
				kind: "LinkedField",
				name: "sessionTodosChanged",
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
						name: "todoCount",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "inProgressCount",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "completedCount",
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
			name: "SessionDetailContentTodosSubscription",
			selections: v1 /*: any*/,
			type: "Subscription",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Operation",
			name: "SessionDetailContentTodosSubscription",
			selections: v1 /*: any*/,
		},
		params: {
			cacheID: "029c10f498710811159a86431dbc6457",
			id: null,
			metadata: {},
			name: "SessionDetailContentTodosSubscription",
			operationKind: "subscription",
			text: "subscription SessionDetailContentTodosSubscription(\n  $sessionId: ID!\n) {\n  sessionTodosChanged(sessionId: $sessionId) {\n    sessionId\n    todoCount\n    inProgressCount\n    completedCount\n  }\n}\n",
		},
	};
})();

(node as any).hash = "f741e787eb505e93074483aedcd5487b";

export default node;
