/**
 * @generated SignedSource<<de88ae10ec6fbf7fe3282da4488d41b4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest, FragmentRefs } from "relay-runtime";
export type DashboardPageQuery$variables = {
	projectId?: string | null | undefined;
};
export type DashboardPageQuery$data = {
	readonly metrics:
		| {
				readonly averageConfidence: number | null | undefined;
				readonly calibrationScore: number | null | undefined;
				readonly completedTasks: number | null | undefined;
				readonly significantFrustrationRate: number | null | undefined;
				readonly significantFrustrations: number | null | undefined;
				readonly successRate: number | null | undefined;
				readonly totalTasks: number | null | undefined;
		  }
		| null
		| undefined;
	readonly pluginCategories:
		| ReadonlyArray<{
				readonly category: string | null | undefined;
				readonly count: number | null | undefined;
		  }>
		| null
		| undefined;
	readonly pluginStats:
		| {
				readonly enabledPlugins: number | null | undefined;
				readonly localPlugins: number | null | undefined;
				readonly projectPlugins: number | null | undefined;
				readonly totalPlugins: number | null | undefined;
				readonly userPlugins: number | null | undefined;
		  }
		| null
		| undefined;
	readonly projects:
		| ReadonlyArray<{
				readonly id: string | null | undefined;
		  }>
		| null
		| undefined;
	readonly sessions:
		| {
				readonly __id: string;
				readonly edges:
					| ReadonlyArray<{
							readonly node:
								| {
										readonly id: string;
										readonly " $fragmentSpreads": FragmentRefs<"SessionListItem_session">;
								  }
								| null
								| undefined;
					  }>
					| null
					| undefined;
		  }
		| null
		| undefined;
	readonly " $fragmentSpreads": FragmentRefs<"DashboardPageActivity_query">;
};
export type DashboardPageQuery = {
	response: DashboardPageQuery$data;
	variables: DashboardPageQuery$variables;
};

const node: ConcreteRequest = (() => {
	var v0 = [
			{
				defaultValue: null,
				kind: "LocalArgument",
				name: "projectId",
			},
		],
		v1 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "id",
			storageKey: null,
		},
		v2 = {
			alias: null,
			args: [
				{
					kind: "Literal",
					name: "first",
					value: 100,
				},
			],
			concreteType: "Project",
			kind: "LinkedField",
			name: "projects",
			plural: true,
			selections: [v1 /*: any*/],
			storageKey: "projects(first:100)",
		},
		v3 = {
			kind: "Variable",
			name: "projectId",
			variableName: "projectId",
		},
		v4 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "__typename",
			storageKey: null,
		},
		v5 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "cursor",
			storageKey: null,
		},
		v6 = {
			alias: null,
			args: null,
			concreteType: "PageInfo",
			kind: "LinkedField",
			name: "pageInfo",
			plural: false,
			selections: [
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "endCursor",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "hasNextPage",
					storageKey: null,
				},
			],
			storageKey: null,
		},
		v7 = {
			kind: "ClientExtension",
			selections: [
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "__id",
					storageKey: null,
				},
			],
		},
		v8 = {
			alias: null,
			args: [
				{
					kind: "Literal",
					name: "period",
					value: "WEEK",
				},
			],
			concreteType: "MetricsData",
			kind: "LinkedField",
			name: "metrics",
			plural: false,
			selections: [
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "totalTasks",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "completedTasks",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "successRate",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "averageConfidence",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "calibrationScore",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "significantFrustrations",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "significantFrustrationRate",
					storageKey: null,
				},
			],
			storageKey: 'metrics(period:"WEEK")',
		},
		v9 = {
			alias: null,
			args: null,
			concreteType: "PluginStats",
			kind: "LinkedField",
			name: "pluginStats",
			plural: false,
			selections: [
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "totalPlugins",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "userPlugins",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "projectPlugins",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "localPlugins",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "enabledPlugins",
					storageKey: null,
				},
			],
			storageKey: null,
		},
		v10 = {
			alias: null,
			args: null,
			concreteType: "PluginCategory",
			kind: "LinkedField",
			name: "pluginCategories",
			plural: true,
			selections: [
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "category",
					storageKey: null,
				},
				{
					alias: null,
					args: null,
					kind: "ScalarField",
					name: "count",
					storageKey: null,
				},
			],
			storageKey: null,
		},
		v11 = [
			{
				kind: "Literal",
				name: "first",
				value: 5,
			},
			v3 /*: any*/,
		],
		v12 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "messageCount",
			storageKey: null,
		},
		v13 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "status",
			storageKey: null,
		},
		v14 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "date",
			storageKey: null,
		},
		v15 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "sessionCount",
			storageKey: null,
		},
		v16 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "inputTokens",
			storageKey: null,
		},
		v17 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "outputTokens",
			storageKey: null,
		},
		v18 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "totalTokens",
			storageKey: null,
		},
		v19 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "model",
			storageKey: null,
		},
		v20 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "displayName",
			storageKey: null,
		};
	return {
		fragment: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Fragment",
			metadata: null,
			name: "DashboardPageQuery",
			selections: [
				v2 /*: any*/,
				{
					alias: "sessions",
					args: [v3 /*: any*/],
					concreteType: "SessionConnection",
					kind: "LinkedField",
					name: "__DashboardPage_sessions_connection",
					plural: false,
					selections: [
						{
							alias: null,
							args: null,
							concreteType: "SessionEdge",
							kind: "LinkedField",
							name: "edges",
							plural: true,
							selections: [
								{
									alias: null,
									args: null,
									concreteType: "Session",
									kind: "LinkedField",
									name: "node",
									plural: false,
									selections: [
										v1 /*: any*/,
										{
											args: null,
											kind: "FragmentSpread",
											name: "SessionListItem_session",
										},
										v4 /*: any*/,
									],
									storageKey: null,
								},
								v5 /*: any*/,
							],
							storageKey: null,
						},
						v6 /*: any*/,
						v7 /*: any*/,
					],
					storageKey: null,
				},
				v8 /*: any*/,
				v9 /*: any*/,
				v10 /*: any*/,
				{
					args: null,
					kind: "FragmentSpread",
					name: "DashboardPageActivity_query",
				},
			],
			type: "Query",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Operation",
			name: "DashboardPageQuery",
			selections: [
				v2 /*: any*/,
				{
					alias: null,
					args: v11 /*: any*/,
					concreteType: "SessionConnection",
					kind: "LinkedField",
					name: "sessions",
					plural: false,
					selections: [
						{
							alias: null,
							args: null,
							concreteType: "SessionEdge",
							kind: "LinkedField",
							name: "edges",
							plural: true,
							selections: [
								{
									alias: null,
									args: null,
									concreteType: "Session",
									kind: "LinkedField",
									name: "node",
									plural: false,
									selections: [
										v1 /*: any*/,
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
										v12 /*: any*/,
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
												v13 /*: any*/,
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
																v1 /*: any*/,
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
																v13 /*: any*/,
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
										v4 /*: any*/,
									],
									storageKey: null,
								},
								v5 /*: any*/,
							],
							storageKey: null,
						},
						v6 /*: any*/,
						v7 /*: any*/,
					],
					storageKey: null,
				},
				{
					alias: null,
					args: v11 /*: any*/,
					filters: ["projectId"],
					handle: "connection",
					key: "DashboardPage_sessions",
					kind: "LinkedHandle",
					name: "sessions",
				},
				v8 /*: any*/,
				v9 /*: any*/,
				v10 /*: any*/,
				{
					alias: null,
					args: [
						{
							kind: "Literal",
							name: "days",
							value: 730,
						},
					],
					concreteType: "ActivityData",
					kind: "LinkedField",
					name: "activity",
					plural: false,
					selections: [
						{
							alias: null,
							args: null,
							concreteType: "DailyActivity",
							kind: "LinkedField",
							name: "dailyActivity",
							plural: true,
							selections: [
								v14 /*: any*/,
								v15 /*: any*/,
								v12 /*: any*/,
								v16 /*: any*/,
								v17 /*: any*/,
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "cachedTokens",
									storageKey: null,
								},
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "linesAdded",
									storageKey: null,
								},
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "linesRemoved",
									storageKey: null,
								},
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "filesChanged",
									storageKey: null,
								},
							],
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							concreteType: "HourlyActivity",
							kind: "LinkedField",
							name: "hourlyActivity",
							plural: true,
							selections: [
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "hour",
									storageKey: null,
								},
								v15 /*: any*/,
								v12 /*: any*/,
							],
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							concreteType: "TokenUsageStats",
							kind: "LinkedField",
							name: "tokenUsage",
							plural: false,
							selections: [
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "totalInputTokens",
									storageKey: null,
								},
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "totalOutputTokens",
									storageKey: null,
								},
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "totalCachedTokens",
									storageKey: null,
								},
								v18 /*: any*/,
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "estimatedCostUsd",
									storageKey: null,
								},
								v12 /*: any*/,
								v15 /*: any*/,
							],
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							concreteType: "DailyModelTokens",
							kind: "LinkedField",
							name: "dailyModelTokens",
							plural: true,
							selections: [
								v14 /*: any*/,
								{
									alias: null,
									args: null,
									concreteType: "ModelTokenEntry",
									kind: "LinkedField",
									name: "models",
									plural: true,
									selections: [
										v19 /*: any*/,
										v20 /*: any*/,
										{
											alias: null,
											args: null,
											kind: "ScalarField",
											name: "tokens",
											storageKey: null,
										},
									],
									storageKey: null,
								},
								v18 /*: any*/,
							],
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							concreteType: "ModelUsageStats",
							kind: "LinkedField",
							name: "modelUsage",
							plural: true,
							selections: [
								v19 /*: any*/,
								v20 /*: any*/,
								v16 /*: any*/,
								v17 /*: any*/,
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "cacheReadTokens",
									storageKey: null,
								},
								{
									alias: null,
									args: null,
									kind: "ScalarField",
									name: "cacheCreationTokens",
									storageKey: null,
								},
								v18 /*: any*/,
							],
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "totalSessions",
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "totalMessages",
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "firstSessionDate",
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "streakDays",
							storageKey: null,
						},
						{
							alias: null,
							args: null,
							kind: "ScalarField",
							name: "totalActiveDays",
							storageKey: null,
						},
					],
					storageKey: "activity(days:730)",
				},
			],
		},
		params: {
			cacheID: "3a48301add383b9e85014419db87a223",
			id: null,
			metadata: {
				connection: [
					{
						count: null,
						cursor: null,
						direction: "forward",
						path: ["sessions"],
					},
				],
			},
			name: "DashboardPageQuery",
			operationKind: "query",
			text: "query DashboardPageQuery(\n  $projectId: String\n) {\n  projects(first: 100) {\n    id\n  }\n  sessions(first: 5, projectId: $projectId) {\n    edges {\n      node {\n        id\n        ...SessionListItem_session\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  metrics(period: WEEK) {\n    totalTasks\n    completedTasks\n    successRate\n    averageConfidence\n    calibrationScore\n    significantFrustrations\n    significantFrustrationRate\n  }\n  pluginStats {\n    totalPlugins\n    userPlugins\n    projectPlugins\n    localPlugins\n    enabledPlugins\n  }\n  pluginCategories {\n    category\n    count\n  }\n  ...DashboardPageActivity_query\n}\n\nfragment DashboardPageActivity_query on Query {\n  activity(days: 730) {\n    dailyActivity {\n      date\n      sessionCount\n      messageCount\n      inputTokens\n      outputTokens\n      cachedTokens\n      linesAdded\n      linesRemoved\n      filesChanged\n    }\n    hourlyActivity {\n      hour\n      sessionCount\n      messageCount\n    }\n    tokenUsage {\n      totalInputTokens\n      totalOutputTokens\n      totalCachedTokens\n      totalTokens\n      estimatedCostUsd\n      messageCount\n      sessionCount\n    }\n    dailyModelTokens {\n      date\n      models {\n        model\n        displayName\n        tokens\n      }\n      totalTokens\n    }\n    modelUsage {\n      model\n      displayName\n      inputTokens\n      outputTokens\n      cacheReadTokens\n      cacheCreationTokens\n      totalTokens\n    }\n    totalSessions\n    totalMessages\n    firstSessionDate\n    streakDays\n    totalActiveDays\n  }\n}\n\nfragment SessionListItem_session on Session {\n  id\n  sessionId\n  name\n  projectName\n  projectSlug\n  projectId\n  worktreeName\n  summary\n  messageCount\n  startedAt\n  updatedAt\n  currentTodo {\n    content\n    activeForm\n    status\n    id\n  }\n  activeTasks {\n    totalCount\n    edges {\n      node {\n        id\n        taskId\n        description\n        type\n        status\n      }\n    }\n  }\n  todoCounts {\n    total\n    pending\n    inProgress\n    completed\n  }\n}\n",
		},
	};
})();

(node as any).hash = "727f360f6c7d95b3649d527033907536";

export default node;
