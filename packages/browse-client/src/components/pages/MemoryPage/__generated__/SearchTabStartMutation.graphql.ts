/**
 * @generated SignedSource<<e98dfd6022e713ae3c0999cf8e3ef383>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type SearchTabStartMutation$variables = {
	model?: string | null | undefined;
	projectPath: string;
	question: string;
};
export type SearchTabStartMutation$data = {
	readonly startMemoryQuery:
		| {
				readonly message: string | null | undefined;
				readonly sessionId: string | null | undefined;
				readonly success: boolean | null | undefined;
		  }
		| null
		| undefined;
};
export type SearchTabStartMutation = {
	response: SearchTabStartMutation$data;
	variables: SearchTabStartMutation$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = {
			defaultValue: null,
			kind: "LocalArgument",
			name: "model",
		},
		v1 = {
			defaultValue: null,
			kind: "LocalArgument",
			name: "projectPath",
		},
		v2 = {
			defaultValue: null,
			kind: "LocalArgument",
			name: "question",
		},
		v3 = [
			{
				alias: null,
				args: [
					{
						kind: "Variable",
						name: "model",
						variableName: "model",
					},
					{
						kind: "Variable",
						name: "projectPath",
						variableName: "projectPath",
					},
					{
						kind: "Variable",
						name: "question",
						variableName: "question",
					},
				],
				concreteType: "MemoryQueryStartResult",
				kind: "LinkedField",
				name: "startMemoryQuery",
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
						name: "success",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "message",
						storageKey: null,
					},
				],
				storageKey: null,
			},
		];
	return {
		fragment: {
			argumentDefinitions: [v0 /*: any*/, v1 /*: any*/, v2 /*: any*/],
			kind: "Fragment",
			metadata: null,
			name: "SearchTabStartMutation",
			selections: v3 /*: any*/,
			type: "Mutation",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: [v2 /*: any*/, v1 /*: any*/, v0 /*: any*/],
			kind: "Operation",
			name: "SearchTabStartMutation",
			selections: v3 /*: any*/,
		},
		params: {
			cacheID: "bf292da921f5dfe7215c8bb082f92e16",
			id: null,
			metadata: {},
			name: "SearchTabStartMutation",
			operationKind: "mutation",
			text: "mutation SearchTabStartMutation(\n  $question: String!\n  $projectPath: String!\n  $model: String\n) {\n  startMemoryQuery(question: $question, projectPath: $projectPath, model: $model) {\n    sessionId\n    success\n    message\n  }\n}\n",
		},
	};
})();

(node as any).hash = "3d76173b436c355d0577d537812e4700";

export default node;
