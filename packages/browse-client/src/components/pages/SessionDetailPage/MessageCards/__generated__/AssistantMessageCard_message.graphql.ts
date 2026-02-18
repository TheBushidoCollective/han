/**
 * @generated SignedSource<<c3c1f1cd076138f6f9db61ee400c54d8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ContentBlockType = "IMAGE" | "TEXT" | "THINKING" | "TOOL_RESULT" | "TOOL_USE" | "%future added value";
export type ToolCategory = "FILE" | "MCP" | "OTHER" | "SEARCH" | "SHELL" | "TASK" | "WEB" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type AssistantMessageCard_message$data = {
  readonly cachedTokens: number | null | undefined;
  readonly content: string | null | undefined;
  readonly contentBlocks: ReadonlyArray<{
    readonly category?: ToolCategory;
    readonly color?: string;
    readonly dataUrl?: string;
    readonly displayName?: string;
    readonly icon?: string;
    readonly input?: string;
    readonly mediaType?: string;
    readonly name?: string;
    readonly preview?: string;
    readonly result?: {
      readonly content: string;
      readonly hasImage: boolean;
      readonly isError: boolean;
      readonly isLong: boolean;
      readonly preview: string;
      readonly toolCallId: string;
    } | null | undefined;
    readonly signature?: string | null | undefined;
    readonly text?: string;
    readonly thinking?: string;
    readonly toolCallId?: string;
    readonly type: ContentBlockType;
  }> | null | undefined;
  readonly hasThinking: boolean | null | undefined;
  readonly hasToolUse: boolean | null | undefined;
  readonly id: string;
  readonly inputTokens: number | null | undefined;
  readonly isToolOnly: boolean | null | undefined;
  readonly model: string | null | undefined;
  readonly outputTokens: number | null | undefined;
  readonly rawJson: string | null | undefined;
  readonly thinkingCount: number | null | undefined;
  readonly timestamp: string;
  readonly toolUseCount: number | null | undefined;
  readonly " $fragmentType": "AssistantMessageCard_message";
};
export type AssistantMessageCard_message$key = {
  readonly " $data"?: AssistantMessageCard_message$data;
  readonly " $fragmentSpreads": FragmentRefs<"AssistantMessageCard_message">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "preview",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "AssistantMessageCard_message",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "timestamp",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "rawJson",
      "storageKey": null
    },
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "contentBlocks",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "type",
          "storageKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "thinking",
              "storageKey": null
            },
            (v1/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "signature",
              "storageKey": null
            }
          ],
          "type": "ThinkingBlock",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "text",
              "storageKey": null
            }
          ],
          "type": "TextBlock",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v2/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "name",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "input",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "category",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "icon",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "displayName",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "color",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "ToolResultBlock",
              "kind": "LinkedField",
              "name": "result",
              "plural": false,
              "selections": [
                (v2/*: any*/),
                (v0/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "isError",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "isLong",
                  "storageKey": null
                },
                (v1/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "hasImage",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "type": "ToolUseBlock",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "mediaType",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "dataUrl",
              "storageKey": null
            }
          ],
          "type": "ImageBlock",
          "abstractKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isToolOnly",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "model",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasThinking",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "thinkingCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasToolUse",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "toolUseCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "inputTokens",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "outputTokens",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "cachedTokens",
      "storageKey": null
    }
  ],
  "type": "AssistantMessage",
  "abstractKey": null
};
})();

(node as any).hash = "9077d6919f52eaea3ad23cba79032b16";

export default node;
