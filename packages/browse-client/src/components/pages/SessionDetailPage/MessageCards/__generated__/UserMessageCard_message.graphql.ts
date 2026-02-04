/**
 * @generated SignedSource<<5e87c94ed3fb8c62821446b1f9e791aa>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from "relay-runtime";
export type ContentBlockType =
	| "IMAGE"
	| "TEXT"
	| "THINKING"
	| "TOOL_RESULT"
	| "TOOL_USE"
	| "%future added value";
export type ToolCategory =
	| "FILE"
	| "MCP"
	| "OTHER"
	| "SEARCH"
	| "SHELL"
	| "TASK"
	| "WEB"
	| "%future added value";

import type { FragmentRefs } from "relay-runtime";
export type UserMessageCard_message$data = {
	readonly __typename: string;
	readonly commandName?: string | null | undefined;
	readonly content: string | null | undefined;
	readonly contentBlocks:
		| ReadonlyArray<{
				readonly category?: ToolCategory | null | undefined;
				readonly color?: string | null | undefined;
				readonly dataUrl?: string | null | undefined;
				readonly displayName?: string | null | undefined;
				readonly icon?: string | null | undefined;
				readonly input?: string | null | undefined;
				readonly mediaType?: string | null | undefined;
				readonly name?: string | null | undefined;
				readonly preview?: string | null | undefined;
				readonly result?:
					| {
							readonly content: string | null | undefined;
							readonly hasImage: boolean | null | undefined;
							readonly isError: boolean | null | undefined;
							readonly isLong: boolean | null | undefined;
							readonly preview: string | null | undefined;
							readonly toolCallId: string | null | undefined;
					  }
					| null
					| undefined;
				readonly signature?: string | null | undefined;
				readonly text?: string | null | undefined;
				readonly thinking?: string | null | undefined;
				readonly toolCallId?: string | null | undefined;
				readonly type: ContentBlockType | null | undefined;
		  }>
		| null
		| undefined;
	readonly id: string | null | undefined;
	readonly rawJson: string | null | undefined;
	readonly sentimentAnalysis:
		| {
				readonly frustrationLevel: string | null | undefined;
				readonly frustrationScore: number | null | undefined;
				readonly sentimentLevel: string | null | undefined;
				readonly sentimentScore: number | null | undefined;
				readonly signals: ReadonlyArray<string> | null | undefined;
		  }
		| null
		| undefined;
	readonly timestamp: any | null | undefined;
	readonly " $fragmentType": "UserMessageCard_message";
};
export type UserMessageCard_message$key = {
	readonly " $data"?: UserMessageCard_message$data;
	readonly " $fragmentSpreads": FragmentRefs<"UserMessageCard_message">;
};

const node: ReaderFragment = (() => {
	var v0 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "content",
			storageKey: null,
		},
		v1 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "preview",
			storageKey: null,
		},
		v2 = {
			alias: null,
			args: null,
			kind: "ScalarField",
			name: "toolCallId",
			storageKey: null,
		};
	return {
		argumentDefinitions: [],
		kind: "Fragment",
		metadata: null,
		name: "UserMessageCard_message",
		selections: [
			{
				alias: null,
				args: null,
				kind: "ScalarField",
				name: "__typename",
				storageKey: null,
			},
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
			v0 /*: any*/,
			{
				alias: null,
				args: null,
				concreteType: null,
				kind: "LinkedField",
				name: "contentBlocks",
				plural: true,
				selections: [
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "type",
						storageKey: null,
					},
					{
						kind: "InlineFragment",
						selections: [
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "thinking",
								storageKey: null,
							},
							v1 /*: any*/,
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "signature",
								storageKey: null,
							},
						],
						type: "ThinkingBlock",
						abstractKey: null,
					},
					{
						kind: "InlineFragment",
						selections: [
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "text",
								storageKey: null,
							},
						],
						type: "TextBlock",
						abstractKey: null,
					},
					{
						kind: "InlineFragment",
						selections: [
							v2 /*: any*/,
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
								name: "input",
								storageKey: null,
							},
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
								name: "icon",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "displayName",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "color",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								concreteType: "ToolResultBlock",
								kind: "LinkedField",
								name: "result",
								plural: false,
								selections: [
									v2 /*: any*/,
									v0 /*: any*/,
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "isError",
										storageKey: null,
									},
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "isLong",
										storageKey: null,
									},
									v1 /*: any*/,
									{
										alias: null,
										args: null,
										kind: "ScalarField",
										name: "hasImage",
										storageKey: null,
									},
								],
								storageKey: null,
							},
						],
						type: "ToolUseBlock",
						abstractKey: null,
					},
					{
						kind: "InlineFragment",
						selections: [
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "mediaType",
								storageKey: null,
							},
							{
								alias: null,
								args: null,
								kind: "ScalarField",
								name: "dataUrl",
								storageKey: null,
							},
						],
						type: "ImageBlock",
						abstractKey: null,
					},
				],
				storageKey: null,
			},
			{
				alias: null,
				args: null,
				concreteType: "SentimentAnalysis",
				kind: "LinkedField",
				name: "sentimentAnalysis",
				plural: false,
				selections: [
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "sentimentScore",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "sentimentLevel",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "frustrationScore",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "frustrationLevel",
						storageKey: null,
					},
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "signals",
						storageKey: null,
					},
				],
				storageKey: null,
			},
			{
				kind: "InlineFragment",
				selections: [
					{
						alias: null,
						args: null,
						kind: "ScalarField",
						name: "commandName",
						storageKey: null,
					},
				],
				type: "CommandUserMessage",
				abstractKey: null,
			},
		],
		type: "UserMessage",
		abstractKey: "__isUserMessage",
	};
})();

(node as any).hash = "69cd43b77a8b636eef691c562f6912b4";

export default node;
