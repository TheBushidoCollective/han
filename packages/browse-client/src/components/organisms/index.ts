/**
 * Organisms - Complex UI sections
 *
 * Organisms are relatively complex UI components composed of groups
 * of molecules and/or atoms and/or other organisms. They form
 * distinct sections of an interface.
 *
 * Note: Some organisms (SessionMessages, SessionSidebar, MessageCards) live in
 * pages/SessionDetailPage/ due to Relay fragment colocation requirements.
 * They are re-exported here for consumers who prefer atomic design imports.
 */

// Content Blocks (colocated with Relay fragments in pages/)
export {
	type ContentBlockData,
	type ContentBlockType,
	ImageBlock,
	type ImageBlockData,
	TextBlock,
	type TextBlockData,
	ThinkingBlock,
	type ThinkingBlockData,
	ToolResultBlock,
	type ToolResultBlockData,
	ToolUseBlock,
	type ToolUseBlockData,
} from "@/components/pages/SessionDetailPage/ContentBlocks";
export { FileChangeCard } from "@/components/pages/SessionDetailPage/FileChangeCard.tsx";
export { HookExecutionCard } from "@/components/pages/SessionDetailPage/HookExecutionCard.tsx";
// MessageCards - main registry and all individual cards (colocated with Relay fragments)
export {
	AssistantMessageCard,
	ExposedToolCallMessageCard,
	ExposedToolResultMessageCard,
	FileHistorySnapshotMessageCard,
	formatRawJson,
	formatTimestamp,
	HookDatetimeMessageCard,
	HookFileChangeMessageCard,
	HookReferenceMessageCard,
	HookResultMessageCard,
	HookRunMessageCard,
	HookScriptMessageCard,
	HookValidationCacheMessageCard,
	HookValidationMessageCard,
	isKnownMessageType,
	McpToolCallMessageCard,
	McpToolResultMessageCard,
	MemoryLearnMessageCard,
	MemoryQueryMessageCard,
	MessageCard,
	MessageContextProvider,
	MessageHeader,
	type MessageRoleInfo,
	type MessageTypename,
	MessageWrapper,
	QueueOperationMessageCard,
	RawJsonView,
	SentimentAnalysisMessageCard,
	SummaryMessageCard,
	SystemMessageCard,
	UnknownEventMessageCard,
	UserMessageCard,
	useMessageContext,
	useRawJsonToggle,
} from "@/components/pages/SessionDetailPage/MessageCards";
// Session Detail organisms (colocated with Relay fragments in pages/)
export { SessionMessages } from "@/components/pages/SessionDetailPage/SessionMessages.tsx";
export { SessionSidebar } from "@/components/pages/SessionDetailPage/SessionSidebar.tsx";
export { TaskCard } from "@/components/pages/SessionDetailPage/TaskCard.tsx";
// Connection management
export { ConnectionGate } from "./ConnectionGate.tsx";
export { ConnectionOverlay } from "./ConnectionOverlay.tsx";
export type { MarkdownContentProps } from "./MarkdownContent.tsx";
export {
	containsAnsi,
	detectContentType,
	looksLikeMarkdown,
	MarkdownContent,
	stripAnsi,
} from "./MarkdownContent.tsx";
export { MockDashboard } from "./MockDashboard.tsx";
export { NavCard } from "./NavCard.tsx";
export { NavItem } from "./NavItem.tsx";
export { ProjectCardItem } from "./ProjectCardItem.tsx";
export { SectionCard } from "./SectionCard.tsx";
export { SessionListItem } from "./SessionListItem.tsx";
export { StatCard } from "./StatCard.tsx";
export type { Toast as ToastType } from "./Toast.tsx";
export { ToastContainer } from "./Toast.tsx";
export type { ViewType, VirtualListRef } from "./VirtualList.tsx";
export { ViewTypes, VirtualList } from "./VirtualList.tsx";
