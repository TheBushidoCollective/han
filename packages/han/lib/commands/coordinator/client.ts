/**
 * GraphQL Client for Coordinator
 *
 * A simple GraphQL client for backend services (MCP, hooks)
 * to communicate with the coordinator daemon.
 *
 * Uses fetch for queries/mutations and graphql-ws for subscriptions.
 * Automatically ensures the coordinator is running before making requests.
 */

import { type Client, createClient } from 'graphql-ws';
import WebSocket from 'ws';
import {
  CoordinatorBinaryMissingError,
  CoordinatorConnectionRefusedError,
  CoordinatorPortOccupiedError,
  coordinatorRequest,
  readCoordinatorDescriptor,
} from '../../coordinator/connection.ts';
import { checkHealth } from './health.ts';

let coordinatorPromise: Promise<void> | null = null;

export async function ensureCoordinatorReady(): Promise<boolean> {
  if (!coordinatorPromise) {
    coordinatorPromise = import('./daemon.ts')
      .then(async ({ ensureCoordinator }) => {
        await ensureCoordinator();
      })
      .finally(() => {
        coordinatorPromise = null;
      });
  }
  await coordinatorPromise;
  return true;
}

/**
 * GraphQL request options
 */
export interface GraphQLRequestOptions {
  variables?: Record<string, unknown>;
  operationName?: string;
}

/**
 * GraphQL response
 */
export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

/**
 * Coordinator GraphQL Client
 */
export class CoordinatorClient {
  private wsClient: Client | null = null;
  private port?: number;

  constructor(port?: number) {
    this.port = port;
  }

  /**
   * Check if the coordinator is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await checkHealth(this.port);
      return health?.status === 'ok';
    } catch (error) {
      if (
        error instanceof CoordinatorPortOccupiedError ||
        error instanceof CoordinatorBinaryMissingError ||
        error instanceof CoordinatorConnectionRefusedError
      ) {
        return false;
      }
      throw error;
    }
  }
  /**
   * Execute a GraphQL query or mutation.
   * Automatically ensures the coordinator is running before making requests.
   */
  async request<T = unknown>(
    query: string,
    options: GraphQLRequestOptions = {}
  ): Promise<GraphQLResponse<T>> {
    // Ensure coordinator is running before making requests
    const ready = await ensureCoordinatorReady();
    if (!ready) {
      throw new Error('Coordinator is not available');
    }

    const response = await coordinatorRequest('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: options.variables,
        operationName: options.operationName,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `GraphQL request failed: ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as GraphQLResponse<T>;
  }

  /**
   * Execute a GraphQL query
   */
  async query<T = unknown>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const result = await this.request<T>(query, { variables });

    if (result.errors && result.errors.length > 0) {
      throw new Error(
        `GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`
      );
    }

    if (!result.data) {
      throw new Error('No data returned from GraphQL query');
    }

    return result.data;
  }

  /**
   * Execute a GraphQL mutation
   */
  async mutate<T = unknown>(
    mutation: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    return this.query<T>(mutation, variables);
  }

  /**
   * Get WebSocket client for subscriptions
   */
  private getWsClient(): Client {
    if (!this.wsClient) {
      const descriptor = readCoordinatorDescriptor();
      const Socket = class extends WebSocket {
        constructor(_url: string, protocols?: string | string[]) {
          const current = readCoordinatorDescriptor();
          super(`wss://127.0.0.1:${current.httpsPort}/graphql`, protocols, {
            ca: current.certificatePem,
            rejectUnauthorized: true,
            headers: { Authorization: `Bearer ${current.bearerToken}` },
          });
        }
      };
      this.wsClient = createClient({
        url: `wss://127.0.0.1:${descriptor.httpsPort}/graphql`,
        webSocketImpl: Socket as unknown as typeof globalThis.WebSocket,
        retryAttempts: 0,
      });
    }
    return this.wsClient;
  }

  /**
   * Subscribe to a GraphQL subscription
   *
   * @returns Unsubscribe function
   */
  subscribe<T = unknown>(
    query: string,
    options: GraphQLRequestOptions & {
      onData: (data: T) => void;
      onError?: (error: Error) => void;
      onComplete?: () => void;
    }
  ): () => void {
    const client = this.getWsClient();

    const unsubscribe = client.subscribe(
      {
        query,
        variables: options.variables,
        operationName: options.operationName,
      },
      {
        next: (result) => {
          if (result.data) {
            options.onData(result.data as T);
          }
          if (result.errors) {
            const error = new Error(
              `GraphQL subscription errors: ${result.errors.map((e) => e.message).join(', ')}`
            );
            options.onError?.(error);
          }
        },
        error: (err) => {
          const error = err instanceof Error ? err : new Error(String(err));
          options.onError?.(error);
        },
        complete: () => {
          options.onComplete?.();
        },
      }
    );

    return unsubscribe;
  }

  /**
   * Close the client and clean up resources
   */
  async close(): Promise<void> {
    if (this.wsClient) {
      await this.wsClient.dispose();
      this.wsClient = null;
    }
  }
}

/**
 * Singleton client instance
 */
let defaultClient: CoordinatorClient | null = null;

/**
 * Get the default coordinator client (singleton)
 */
export function getCoordinatorClient(port?: number): CoordinatorClient {
  if (!defaultClient) {
    defaultClient = new CoordinatorClient(port);
  }
  return defaultClient;
}

/**
 * Create a new coordinator client
 */
export function createCoordinatorClient(port?: number): CoordinatorClient {
  return new CoordinatorClient(port);
}
