/**
 * Types for the browse feature
 */

/**
 * Options for the browse command
 */
export interface BrowseOptions {
	/** Port to run the server on (0 for random) */
	port?: number;
	/** Whether to automatically open the browser */
	autoOpen?: boolean;
}

/**
 * Memory event for SSE updates
 */
export interface MemoryEvent {
	/** Type of memory that changed */
	type: "session" | "summary" | "rule" | "observation" | "reload";
	/** What action occurred */
	action: "created" | "updated" | "deleted";
	/** Path to the affected file */
	path: string;
	/** Unix timestamp of when the event occurred */
	timestamp: number;
}

/**
 * SSE client connection
 */
export interface SSEClient {
	/** Stream controller for sending events */
	controller: ReadableStreamDefaultController;
	/** Unique identifier for this client */
	id: string;
}

/**
 * Result from starting the browse server
 */
export interface BrowseServerResult {
	/** The Bun server instance */
	server: ReturnType<typeof Bun.serve>;
	/** The port the server is running on */
	port: number;
	/** The full URL to access the server */
	url: string;
	/** Function to broadcast events to all connected SSE clients */
	broadcast: (event: MemoryEvent) => void;
}
