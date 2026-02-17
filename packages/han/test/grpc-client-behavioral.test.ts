/**
 * Behavioral tests for lib/grpc/client.ts
 *
 * Tests the client factory, singleton management, port configuration,
 * and health check behavior — exercising the REAL code (not mocks).
 */
import { beforeEach, describe, expect, test } from 'bun:test';

// Import the REAL client module (no mocking!)
const {
  createCoordinatorClients,
  getCoordinatorClients,
  setCoordinatorPort,
  isCoordinatorHealthy,
} = await import('../lib/grpc/client.ts');

// ============================================================================
// createCoordinatorClients
// ============================================================================

describe('createCoordinatorClients', () => {
  test('returns an object with all 6 service clients', () => {
    const clients = createCoordinatorClients(19999);

    expect(clients.coordinator).toBeDefined();
    expect(clients.sessions).toBeDefined();
    expect(clients.indexer).toBeDefined();
    expect(clients.hooks).toBeDefined();
    expect(clients.slots).toBeDefined();
    expect(clients.memory).toBeDefined();
  });

  test('creates different client instances for different ports', () => {
    const clients1 = createCoordinatorClients(19998);
    const clients2 = createCoordinatorClients(19997);

    // Different transport means different client instances
    expect(clients1).not.toBe(clients2);
  });

  test('uses default port when no argument provided', () => {
    // Should not throw
    const clients = createCoordinatorClients();
    expect(clients.coordinator).toBeDefined();
  });
});

// ============================================================================
// getCoordinatorClients (singleton)
// ============================================================================

describe('getCoordinatorClients', () => {
  test('returns the same instance on repeated calls', () => {
    const clients1 = getCoordinatorClients();
    // Tag the instance to verify identity (avoids Bun toBe issues with Proxy objects)
    (clients1 as Record<string, unknown>).__singleton_test = true;
    const clients2 = getCoordinatorClients();
    expect((clients2 as Record<string, unknown>).__singleton_test).toBe(true);
  });

  test('returns an object with all service clients', () => {
    const clients = getCoordinatorClients();

    expect(clients.coordinator).toBeDefined();
    expect(clients.sessions).toBeDefined();
    expect(clients.indexer).toBeDefined();
    expect(clients.hooks).toBeDefined();
    expect(clients.slots).toBeDefined();
    expect(clients.memory).toBeDefined();
  });
});

// ============================================================================
// setCoordinatorPort
// ============================================================================

describe('setCoordinatorPort', () => {
  test('accepts a port number without throwing', () => {
    // Should not throw
    setCoordinatorPort(41957);
  });

  test('setting a different port resets the singleton', () => {
    // Get initial clients
    const clientsBefore = getCoordinatorClients();

    // Set a different port — should reset singleton
    setCoordinatorPort(29999);

    // Get clients again — should be a new instance
    const clientsAfter = getCoordinatorClients();

    expect(clientsBefore).not.toBe(clientsAfter);

    // Reset to default
    setCoordinatorPort(41956);
  });

  test('setting the same port does not reset singleton', () => {
    // Set a port and get clients
    setCoordinatorPort(41956);
    const clients1 = getCoordinatorClients();

    // Set the SAME port
    setCoordinatorPort(41956);
    const clients2 = getCoordinatorClients();

    // Should be the same instance (no reset)
    expect(clients1).toBe(clients2);
  });
});

// ============================================================================
// isCoordinatorHealthy
// ============================================================================

describe('isCoordinatorHealthy', () => {
  test('returns false when no coordinator is running', async () => {
    // Use a port where nothing is listening
    const healthy = await isCoordinatorHealthy(19876, 500);
    expect(healthy).toBe(false);
  });

  test('returns false on connection refused', async () => {
    const healthy = await isCoordinatorHealthy(1, 500);
    expect(healthy).toBe(false);
  });

  test('uses default port and timeout when called with no args', async () => {
    // This will try to connect to default port (41956)
    // and return false since coordinator isn't running in tests
    const healthy = await isCoordinatorHealthy();
    expect(typeof healthy).toBe('boolean');
  });
});
