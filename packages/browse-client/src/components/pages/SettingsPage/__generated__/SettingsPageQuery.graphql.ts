/**
 * @generated SignedSource<<82414f6ffbd45bd4f2985fea60dda19e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from "relay-runtime";
export type SettingsPageQuery$variables = {
	projectId?: string | null | undefined;
};
export type SettingsPageQuery$data = {
	readonly settings:
		| {
				readonly claudeSettings:
					| {
							readonly exists: boolean | null | undefined;
							readonly hasPermissions: boolean | null | undefined;
							readonly lastModified: string | null | undefined;
							readonly mcpServerCount: number | null | undefined;
							readonly path: string | null | undefined;
							readonly pluginCount: number | null | undefined;
					  }
					| null
					| undefined;
				readonly claudeSettingsFiles:
					| ReadonlyArray<{
							readonly exists: boolean | null | undefined;
							readonly lastModified: string | null | undefined;
							readonly path: string | null | undefined;
							readonly source: string | null | undefined;
							readonly sourceLabel: string | null | undefined;
							readonly type: string | null | undefined;
					  }>
					| null
					| undefined;
				readonly hanConfig:
					| {
							readonly exists: boolean | null | undefined;
							readonly hooksEnabled: boolean | null | undefined;
							readonly lastModified: string | null | undefined;
							readonly memoryEnabled: boolean | null | undefined;
							readonly metricsEnabled: boolean | null | undefined;
							readonly path: string | null | undefined;
							readonly pluginConfigCount: number | null | undefined;
					  }
					| null
					| undefined;
				readonly hanConfigFiles:
					| ReadonlyArray<{
							readonly exists: boolean | null | undefined;
							readonly lastModified: string | null | undefined;
							readonly path: string | null | undefined;
							readonly source: string | null | undefined;
							readonly sourceLabel: string | null | undefined;
							readonly type: string | null | undefined;
					  }>
					| null
					| undefined;
				readonly mcpServers:
					| ReadonlyArray<{
							readonly argCount: number | null | undefined;
							readonly command: string | null | undefined;
							readonly hasEnv: boolean | null | undefined;
							readonly id: string | null | undefined;
							readonly name: string | null | undefined;
							readonly type: string | null | undefined;
							readonly url: string | null | undefined;
					  }>
					| null
					| undefined;
				readonly permissions:
					| {
							readonly additionalDirectories:
								| ReadonlyArray<string>
								| null
								| undefined;
							readonly allowedTools: ReadonlyArray<string> | null | undefined;
							readonly deniedTools: ReadonlyArray<string> | null | undefined;
					  }
					| null
					| undefined;
		  }
		| null
		| undefined;
};
export type SettingsPageQuery = {
	response: SettingsPageQuery$data;
	variables: SettingsPageQuery$variables;
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
			name: "path",
			storageKey: null,
		},
		v2 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "exists",
			storageKey: null,
		},
		v3 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "lastModified",
			storageKey: null,
		},
		v4 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "type",
			storageKey: null,
		},
		v5 = [
			v1 /*: any*/,
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "source",
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "sourceLabel",
				storageKey: null,
			},
			v2 /*: any*/,
			v3 /*: any*/,
			v4 /*: any*/,
		],
		v6 = [
			{
				alias: null,
				args: [
					{
						kind: "Variable",
						name: "projectId",
						variableName: "projectId",
					},
				],
				concreteType: "SettingsSummary",
				kind: "LinkedField",
				name: "settings",
				plural: false,
				selections: [
					{
						alias: null,
						args: null,
						concreteType: "SettingsFile",
						kind: "LinkedField",
						name: "claudeSettingsFiles",
						plural: true,
						selections: v5 /*: any*/,
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						concreteType: "SettingsFile",
						kind: "LinkedField",
						name: "hanConfigFiles",
						plural: true,
						selections: v5 /*: any*/,
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						concreteType: "ClaudeSettingsSummary",
						kind: "LinkedField",
						name: "claudeSettings",
						plural: false,
						selections: [
							v1 /*: any*/,
							v2 /*: any*/,
							v3 /*: any*/,
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "pluginCount",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "mcpServerCount",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "hasPermissions",
								storageKey: null,
							},
						],
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						concreteType: "HanConfigSummary",
						kind: "LinkedField",
						name: "hanConfig",
						plural: false,
						selections: [
							v1 /*: any*/,
							v2 /*: any*/,
							v3 /*: any*/,
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "hooksEnabled",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "memoryEnabled",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "metricsEnabled",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "pluginConfigCount",
								storageKey: null,
							},
						],
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						concreteType: "McpServer",
						kind: "LinkedField",
						name: "mcpServers",
						plural: true,
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
								name: "name",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "command",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "url",
								storageKey: null,
							},
							v4 /*: any*/,
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "argCount",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "hasEnv",
								storageKey: null,
							},
						],
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						concreteType: "Permissions",
						kind: "LinkedField",
						name: "permissions",
						plural: false,
						selections: [
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "allowedTools",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "deniedTools",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "additionalDirectories",
								storageKey: null,
							},
						],
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
			name: "SettingsPageQuery",
			selections: v6 /*: any*/,
			type: "Query",
			abstractKey: null,
		},
		kind: "Request",
		operation: {
			argumentDefinitions: v0 /*: any*/,
			kind: "Operation",
			name: "SettingsPageQuery",
			selections: v6 /*: any*/,
		},
		params: {
			cacheID: "e4cb21bcc3ff888f577b46be34365fbd",
			id: null,
			metadata: {},
			name: "SettingsPageQuery",
			operationKind: "query",
			text: "query SettingsPageQuery(\n  $projectId: String\n) {\n  settings(projectId: $projectId) {\n    claudeSettingsFiles {\n      path\n      source\n      sourceLabel\n      exists\n      lastModified\n      type\n    }\n    hanConfigFiles {\n      path\n      source\n      sourceLabel\n      exists\n      lastModified\n      type\n    }\n    claudeSettings {\n      path\n      exists\n      lastModified\n      pluginCount\n      mcpServerCount\n      hasPermissions\n    }\n    hanConfig {\n      path\n      exists\n      lastModified\n      hooksEnabled\n      memoryEnabled\n      metricsEnabled\n      pluginConfigCount\n    }\n    mcpServers {\n      id\n      name\n      command\n      url\n      type\n      argCount\n      hasEnv\n    }\n    permissions {\n      allowedTools\n      deniedTools\n      additionalDirectories\n    }\n  }\n}\n",
		},
	};
})();

(node as any).hash = "8fed1892467c80241e7338d02c304be4";

export default node;
