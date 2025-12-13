/**
 * Type declarations for optional dependencies
 * These modules may not be installed - they're loaded dynamically
 */

declare module "@lancedb/lancedb" {
	export function connect(path: string): Promise<unknown>;
}

declare module "@xenova/transformers" {
	export function pipeline(
		task: string,
		model: string,
	): Promise<
		(text: string, options: unknown) => Promise<{ data: Float32Array }>
	>;
}
