/**
 * Environment Management for Multiple Coordinator Instances
 *
 * Supports switching between different local coordinator installations
 * (e.g., ~/.claude on port 41900, ~/.work-claude on port 41901)
 */

export interface Environment {
  id: string;
  name: string;
  coordinatorUrl: string; // e.g., https://coordinator.local.han.guru:41900
  wsUrl: string; // e.g., wss://coordinator.local.han.guru:41900
  lastConnected?: string; // ISO timestamp
}

const STORAGE_KEY = 'han:environments';
const ACTIVE_ENV_KEY = 'han:activeEnvironment';

/**
 * Get all stored environments from localStorage
 */
export function getStoredEnvironments(): Environment[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Save environments to localStorage
 */
export function saveEnvironments(environments: Environment[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(environments));
  } catch (error) {
    console.error('Failed to save environments:', error);
  }
}

/**
 * Get the currently active environment ID
 */
export function getActiveEnvironmentId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(ACTIVE_ENV_KEY);
  } catch {
    return null;
  }
}

/**
 * Set the active environment ID
 */
export function setActiveEnvironmentId(id: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (id === null) {
      localStorage.removeItem(ACTIVE_ENV_KEY);
    } else {
      localStorage.setItem(ACTIVE_ENV_KEY, id);
    }
  } catch (error) {
    console.error('Failed to set active environment:', error);
  }
}

/**
 * Get the currently active environment
 */
export function getActiveEnvironment(): Environment | null {
  const id = getActiveEnvironmentId();
  if (!id) return null;

  const environments = getStoredEnvironments();
  return environments.find((env) => env.id === id) ?? null;
}

/**
 * Validate that a URL has proper protocol
 */
function isValidCoordinatorUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

function isValidWsUrl(url: string): boolean {
  return url.startsWith('wss://') || url.startsWith('ws://');
}

/**
 * Add a new environment
 */
export function addEnvironment(env: Omit<Environment, 'id'>): Environment {
  // Validate URLs before saving
  if (!isValidCoordinatorUrl(env.coordinatorUrl)) {
    throw new Error(
      `Invalid coordinatorUrl: ${env.coordinatorUrl}. Must start with https:// or http://`
    );
  }
  if (!isValidWsUrl(env.wsUrl)) {
    throw new Error(
      `Invalid wsUrl: ${env.wsUrl}. Must start with wss:// or ws://`
    );
  }

  const newEnv: Environment = {
    ...env,
    id: generateId(),
  };

  const environments = getStoredEnvironments();
  environments.push(newEnv);
  saveEnvironments(environments);

  // If this is the first environment, make it active
  if (environments.length === 1) {
    setActiveEnvironmentId(newEnv.id);
  }

  return newEnv;
}

/**
 * Update an existing environment
 */
export function updateEnvironment(
  id: string,
  updates: Partial<Omit<Environment, 'id'>>
): boolean {
  const environments = getStoredEnvironments();
  const index = environments.findIndex((env) => env.id === id);

  if (index === -1) return false;

  environments[index] = { ...environments[index], ...updates };
  saveEnvironments(environments);
  return true;
}

/**
 * Delete an environment
 */
export function deleteEnvironment(id: string): boolean {
  const environments = getStoredEnvironments();
  const filtered = environments.filter((env) => env.id !== id);

  if (filtered.length === environments.length) return false;

  saveEnvironments(filtered);

  // If we deleted the active environment, clear active state
  if (getActiveEnvironmentId() === id) {
    setActiveEnvironmentId(null);
  }

  return true;
}

/**
 * Update last connected timestamp for an environment
 */
export function updateLastConnected(id: string): void {
  updateEnvironment(id, { lastConnected: new Date().toISOString() });
}

/**
 * Check if an environment is reachable
 */
export async function checkEnvironmentHealth(
  env: Environment
): Promise<boolean> {
  try {
    const response = await fetch(`${env.coordinatorUrl}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data?.data?.__typename === 'Query';
  } catch {
    return false;
  }
}

/**
 * Generate a unique ID for an environment
 */
function generateId(): string {
  return `env-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create default local environment
 */
export function createDefaultEnvironment(port = 41957): Environment {
  return {
    id: generateId(),
    name: 'Default Local',
    coordinatorUrl: `https://coordinator.local.han.guru:${port}`,
    wsUrl: `wss://coordinator.local.han.guru:${port}`,
  };
}
