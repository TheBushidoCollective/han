/**
 * @generated SignedSource<<8737ad062ab50a12da6f72b841e5db61>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from "relay-runtime";
export type TaskStatus =
	| "ACTIVE"
	| "COMPLETED"
	| "FAILED"
	| "%future added value";
export type TaskType =
	| "FIX"
	| "IMPLEMENTATION"
	| "REFACTOR"
	| "RESEARCH"
	| "%future added value";
export type TodoStatus =
	| "COMPLETED"
	| "IN_PROGRESS"
	| "PENDING"
	| "%future added value";

import type { FragmentRefs } from "relay-runtime";
export type SessionListItem_session$data = {
	readonly activeTasks:
		| {
				readonly edges:
					| ReadonlyArray<{
							readonly node:
								| {
										readonly description: string | null | undefined;
										readonly id: string | null | undefined;
										readonly status: TaskStatus | null | undefined;
										readonly taskId: string | null | undefined;
										readonly type: TaskType | null | undefined;
								  }
								| null
								| undefined;
					  }>
					| null
					| undefined;
				readonly totalCount: number | null | undefined;
		  }
		| null
		| undefined;
	readonly currentTodo:
		| {
				readonly activeForm: string | null | undefined;
				readonly content: string | null | undefined;
				readonly status: TodoStatus | null | undefined;
		  }
		| null
		| undefined;
	readonly id: string;
	readonly messageCount: number | null | undefined;
	readonly name: string | null | undefined;
	readonly projectId: string | null | undefined;
	readonly projectName: string | null | undefined;
	readonly projectSlug: string | null | undefined;
	readonly sessionId: string | null | undefined;
	readonly startedAt: any | null | undefined;
	readonly summary: string | null | undefined;
	readonly todoCounts:
		| {
				readonly completed: number | null | undefined;
				readonly inProgress: number | null | undefined;
				readonly pending: number | null | undefined;
				readonly total: number | null | undefined;
		  }
		| null
		| undefined;
	readonly updatedAt: any | null | undefined;
	readonly worktreeName: string | null | undefined;
	readonly " $fragmentType": "SessionListItem_session";
};
export type SessionListItem_session$key = {
	readonly " $data"?: SessionListItem_session$data;
	readonly " $fragmentSpreads": FragmentRefs<"SessionListItem_session">;
};

const node: ReaderFragment = (() => {
	var v0 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "id",
			storageKey: null,
		},
		v1 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "status",
			storageKey: null,
		};
	return {
		argumentDefinitions: [],
		kind: "Fragment",
		metadata: null,
		name: "SessionListItem_session",
		selections: [
			v0 /*: any*/,
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
				name: "name",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "projectName",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "projectSlug",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "projectId",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "worktreeName",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "summary",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "messageCount",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "startedAt",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "updatedAt",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				concreteType: "Todo",
				kind: "LinkedField",
				name: "currentTodo",
				plural: false,
				selections: [
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "content",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "activeForm",
						storageKey: null,
					},
					v1 /*: any*/,
				],
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				concreteType: "TaskConnection",
				kind: "LinkedField",
				name: "activeTasks",
				plural: false,
				selections: [
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "totalCount",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						concreteType: "TaskEdge",
						kind: "LinkedField",
						name: "edges",
						plural: true,
						selections: [
							{
								alias: null,
								args: null,
								concreteType: "Task",
								kind: "LinkedField",
								name: "node",
								plural: false,
								selections: [
									v0 /*: any*/,
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "taskId",
										storageKey: null,
									},
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "description",
										storageKey: null,
									},
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "type",
										storageKey: null,
									},
									v1 /*: any*/,
								],
								storageKey: null,
							},
						],
						storageKey: null,
					},
				],
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				concreteType: "TodoCounts",
				kind: "LinkedField",
				name: "todoCounts",
				plural: false,
				selections: [
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "total",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "pending",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "inProgress",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "completed",
						storageKey: null,
					},
				],
				storageKey: null,
			},
		],
		type: "Session",
		abstractKey: null,
	};
})();

(node as any).hash = "40ebbd7ccf815f1d12a348b5c421ae56";

export default node;
