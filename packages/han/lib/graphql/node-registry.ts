/**
 * Node Registry for Relay Global IDs
 *
 * Manages global ID encoding/decoding in {Typename}_{ID} format.
 * Provides node lookup for the Node interface.
 */

/**
 * Parsed global ID
 */
export interface ParsedGlobalId {
  typename: string;
  id: string;
}

/**
 * Encode a global ID in {Typename}:{ID} format (colon-delimited)
 */
export function encodeGlobalId(typename: string, id: string): string {
  return `${typename}:${id}`;
}

/**
 * Decode a global ID from {Typename}:{ID} format (colon-delimited)
 * Only splits on the first colon - ID portion can contain additional colons
 * Returns null if the format is invalid
 */
export function decodeGlobalId(globalId: string): ParsedGlobalId | null {
  const colonIndex = globalId.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const typename = globalId.substring(0, colonIndex);
  const id = globalId.substring(colonIndex + 1);

  if (!typename || !id) {
    return null;
  }

  return { typename, id };
}

/**
 * Node loader function type
 */
export type NodeLoader<T> = (id: string) => T | null | Promise<T | null>;

/**
 * Node registry for managing loaders
 */
const nodeLoaders = new Map<string, NodeLoader<unknown>>();

/**
 * Register a node loader for a typename
 */
export function registerNodeLoader<T>(
  typename: string,
  loader: NodeLoader<T>
): void {
  nodeLoaders.set(typename, loader as NodeLoader<unknown>);
}

/**
 * Get a node loader for a typename
 */
export function getNodeLoader(typename: string): NodeLoader<unknown> | null {
  return nodeLoaders.get(typename) ?? null;
}

/**
 * Resolve a node by global ID
 */
export async function resolveNode(
  globalId: string
): Promise<{ typename: string; value: unknown } | null> {
  const parsed = decodeGlobalId(globalId);
  if (!parsed) {
    return null;
  }

  const loader = getNodeLoader(parsed.typename);
  if (!loader) {
    return null;
  }

  const value = await loader(parsed.id);
  if (!value) {
    return null;
  }

  return { typename: parsed.typename, value };
}

/**
 * Get all registered typenames
 */
export function getRegisteredTypenames(): string[] {
  return Array.from(nodeLoaders.keys());
}
