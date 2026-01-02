/**
 * Relay Environment
 *
 * Creates the Relay environment with network layer for queries,
 * mutations, and subscriptions.
 *
 * Supports @defer directive via multipart/mixed response streaming.
 */

import { type Client, createClient } from 'graphql-ws';
import {
  Environment,
  type FetchFunction,
  type GraphQLResponse,
  Network,
  Observable,
  type ObservableFromValue,
  RecordSource,
  Store,
  type SubscribeFunction,
} from 'relay-runtime';

/**
 * Default coordinator port
 */
const COORDINATOR_PORT = 41957;

/**
 * Get the GraphQL endpoint URL
 * Always connects to the coordinator daemon at port 41957
 */
function getGraphQLUrl(): string {
  // Check for Vite-injected URL first (development mode)
  if (import.meta.env?.VITE_GRAPHQL_URL) {
    return import.meta.env.VITE_GRAPHQL_URL;
  }
  // Default to coordinator port
  return `http://127.0.0.1:${COORDINATOR_PORT}/graphql`;
}

/**
 * Parse a multipart/mixed response for @defer support
 *
 * GraphQL servers return incremental payloads in a multipart format:
 * --boundary
 * Content-Type: application/json
 *
 * {"data": {...}, "hasNext": true}
 * --boundary
 * Content-Type: application/json
 *
 * {"incremental": [...], "hasNext": false}
 * --boundary--
 */
async function* parseMultipartResponse(
  response: Response,
  boundary: string
): AsyncGenerator<GraphQLResponse> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  // Multipart boundaries must be preceded by CRLF (except the first one)
  // The actual delimiter in the body is CRLF + "--" + boundary
  const boundaryMarker = `--${boundary}`;
  const crlfDelimiter = `\r\n${boundaryMarker}`;
  const lfDelimiter = `\n${boundaryMarker}`;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Find and skip the initial boundary marker at the start of the response
      // The first boundary is NOT preceded by CRLF
      if (buffer.startsWith(boundaryMarker)) {
        buffer = buffer.slice(boundaryMarker.length);
        // Skip trailing CRLF or LF after the initial boundary
        if (buffer.startsWith('\r\n')) {
          buffer = buffer.slice(2);
        } else if (buffer.startsWith('\n')) {
          buffer = buffer.slice(1);
        }
      } else if (buffer.startsWith(`\r\n${boundaryMarker}`)) {
        buffer = buffer.slice(2 + boundaryMarker.length);
        if (buffer.startsWith('\r\n')) {
          buffer = buffer.slice(2);
        } else if (buffer.startsWith('\n')) {
          buffer = buffer.slice(1);
        }
      }

      // Now process parts - look for CRLF+boundary or LF+boundary as delimiters
      // This prevents matching "---" that appears inside JSON content
      let delimiterIndex = buffer.indexOf(crlfDelimiter);
      let delimiterLen = crlfDelimiter.length;
      if (delimiterIndex === -1) {
        delimiterIndex = buffer.indexOf(lfDelimiter);
        delimiterLen = lfDelimiter.length;
      }

      while (delimiterIndex !== -1) {
        // Extract the part (headers + body) before the delimiter
        const part = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + delimiterLen);

        // Parse the part - find headers and body
        if (part.trim()) {
          // Find the JSON body after headers (separated by double newline)
          let bodyStart = part.indexOf('\r\n\r\n');
          let headerSepLen = 4;
          if (bodyStart === -1) {
            bodyStart = part.indexOf('\n\n');
            headerSepLen = 2;
          }
          if (bodyStart !== -1) {
            const jsonStr = part.slice(bodyStart + headerSepLen).trim();
            if (jsonStr) {
              try {
                const json = JSON.parse(jsonStr);
                yield json as GraphQLResponse;
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Check for end marker (--boundary--)
        if (buffer.startsWith('--')) {
          // End of multipart
          break;
        }

        // Skip leading newline after delimiter if present
        if (buffer.startsWith('\r\n')) {
          buffer = buffer.slice(2);
        } else if (buffer.startsWith('\n')) {
          buffer = buffer.slice(1);
        }

        // Look for next delimiter
        delimiterIndex = buffer.indexOf(crlfDelimiter);
        delimiterLen = crlfDelimiter.length;
        if (delimiterIndex === -1) {
          delimiterIndex = buffer.indexOf(lfDelimiter);
          delimiterLen = lfDelimiter.length;
        }
      }
    }

    // Process any remaining buffer (last part before final boundary)
    if (buffer.trim() && !buffer.trim().startsWith('--')) {
      // Handle both \r\n\r\n and \n\n
      let bodyStart = buffer.indexOf('\r\n\r\n');
      let headerSepLen = 4;
      if (bodyStart === -1) {
        bodyStart = buffer.indexOf('\n\n');
        headerSepLen = 2;
      }
      if (bodyStart !== -1) {
        const jsonStr = buffer.slice(bodyStart + headerSepLen).trim();
        if (jsonStr) {
          try {
            const json = JSON.parse(jsonStr);
            yield json as GraphQLResponse;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Extract boundary from Content-Type header
 */
function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
  return match ? match[1] || match[2] : null;
}

/**
 * Fetch function for queries and mutations
 *
 * Supports @defer via multipart/mixed response streaming.
 * Returns an Observable to allow incremental delivery.
 */
const fetchFn: FetchFunction = (
  request,
  variables
): ObservableFromValue<GraphQLResponse> => {
  return Observable.create((sink) => {
    let aborted = false;
    const abortController = new AbortController();

    (async () => {
      try {
        const response = await fetch(getGraphQLUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Request multipart format for @defer support
            Accept: 'multipart/mixed;deferSpec=20220824,application/json',
          },
          body: JSON.stringify({
            query: request.text,
            variables,
          }),
          signal: abortController.signal,
        });

        if (aborted) return;

        const contentType = response.headers.get('Content-Type') || '';

        // Check if response is multipart (for @defer)
        if (contentType.includes('multipart/mixed')) {
          const boundary = extractBoundary(contentType);
          if (!boundary) {
            throw new Error('Missing boundary in multipart response');
          }

          // Stream multipart responses
          for await (const part of parseMultipartResponse(response, boundary)) {
            if (aborted) break;
            sink.next(part);
          }
        } else {
          // Regular JSON response
          const json = await response.json();
          if (!aborted) {
            sink.next(json as GraphQLResponse);
          }
        }

        if (!aborted) {
          sink.complete();
        }
      } catch (error) {
        if (!aborted) {
          sink.error(error instanceof Error ? error : new Error(String(error)));
        }
      }
    })();

    // Cleanup function
    return () => {
      aborted = true;
      abortController.abort();
    };
  });
};

/**
 * Get the GraphQL WebSocket URL
 * Always connects to the coordinator daemon at port 41957
 */
function getGraphQLWsUrl(): string {
  // Check for Vite-injected URL first (development mode)
  if (import.meta.env?.VITE_GRAPHQL_WS_URL) {
    return import.meta.env.VITE_GRAPHQL_WS_URL;
  }
  // Default to coordinator port
  return `ws://127.0.0.1:${COORDINATOR_PORT}/graphql`;
}

/**
 * Singleton WebSocket client for subscriptions
 */
let wsClient: Client | null = null;

function getWsClient(): Client {
  if (typeof window === 'undefined') {
    throw new Error('WebSocket client can only be created on the client side');
  }

  if (!wsClient) {
    wsClient = createClient({
      url: getGraphQLWsUrl(),
      retryAttempts: 5,
      shouldRetry: () => true,
    });
  }
  return wsClient;
}

/**
 * Subscribe function for GraphQL subscriptions
 */
const subscribeFn: SubscribeFunction = (request, variables) => {
  return Observable.create((sink) => {
    const client = getWsClient();

    const unsubscribe = client.subscribe(
      {
        query: request.text ?? '',
        variables,
      },
      {
        next: (result) => {
          sink.next(result as GraphQLResponse);
        },
        error: (err) => {
          sink.error(err instanceof Error ? err : new Error(String(err)));
        },
        complete: () => {
          sink.complete();
        },
      }
    );

    return () => {
      unsubscribe();
    };
  });
};

/**
 * Create a new Relay environment
 */
function createEnvironment(): Environment {
  const network = Network.create(fetchFn, subscribeFn);
  const store = new Store(new RecordSource());

  return new Environment({
    network,
    store,
  });
}

/**
 * Singleton environment for client-side use
 */
let relayEnvironment: Environment | null = null;

/**
 * Get the Relay environment (singleton on client, fresh on server)
 */
export function getRelayEnvironment(): Environment {
  // Server-side: always create a new environment
  if (typeof window === 'undefined') {
    return createEnvironment();
  }

  // Client-side: reuse singleton
  if (!relayEnvironment) {
    relayEnvironment = createEnvironment();
  }

  return relayEnvironment;
}

export default getRelayEnvironment;
