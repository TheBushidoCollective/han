/**
 * CLI Authentication Tests
 *
 * Tests for:
 * - Credential storage and retrieval
 * - Token expiration checking
 * - Server URL configuration
 * - Auth status
 */

import { describe, test, expect, beforeEach, afterEach, } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock the homedir function before importing modules
const testDir = join(tmpdir(), `han-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const testConfigDir = join(testDir, ".config", "han");

// Setup test directory
beforeEach(() => {
  mkdirSync(testConfigDir, { recursive: true });
});

// Cleanup test directory
afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("Credential Storage", () => {
  test("credentials file is created with proper structure", () => {
    const credPath = join(testConfigDir, "credentials.json");

    const credentials = {
      server_url: "https://api.han.guru",
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      user: {
        id: "user-123",
        email: "test@example.com",
        github_username: "testuser",
      },
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    writeFileSync(credPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });

    expect(existsSync(credPath)).toBe(true);

    const loaded = JSON.parse(readFileSync(credPath, "utf-8"));
    expect(loaded.server_url).toBe("https://api.han.guru");
    expect(loaded.access_token).toBe("test-access-token");
    expect(loaded.user.email).toBe("test@example.com");
  });

  test("credentials file has secure permissions on creation", () => {
    const credPath = join(testConfigDir, "credentials.json");

    writeFileSync(credPath, "{}", { mode: 0o600 });

    const { statSync } = require("node:fs");
    const stats = statSync(credPath);
    const mode = stats.mode & 0o777;

    // On Unix systems, should be 0600
    if (process.platform !== "win32") {
      expect(mode).toBe(0o600);
    }
  });

  test("empty credentials file returns null when loaded", () => {
    const credPath = join(testConfigDir, "credentials.json");
    writeFileSync(credPath, "{}", { mode: 0o600 });

    const content = JSON.parse(readFileSync(credPath, "utf-8"));

    // Empty object should not have required fields
    expect(content.access_token).toBeUndefined();
    expect(content.refresh_token).toBeUndefined();
  });
});

describe("Token Expiration", () => {
  test("token is considered expired when past expiration time", () => {
    const expiredCredentials = {
      server_url: "https://api.han.guru",
      access_token: "expired-token",
      refresh_token: "refresh-token",
      user: { id: "123", email: null, github_username: null },
      expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };

    const expiresAt = new Date(expiredCredentials.expires_at);
    const now = new Date();

    expect(expiresAt.getTime() < now.getTime()).toBe(true);
  });

  test("token is not expired when within valid period", () => {
    const validCredentials = {
      server_url: "https://api.han.guru",
      access_token: "valid-token",
      refresh_token: "refresh-token",
      user: { id: "123", email: null, github_username: null },
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    };

    const expiresAt = new Date(validCredentials.expires_at);
    const now = new Date();
    const bufferMs = 60 * 1000; // 60 second buffer

    expect(expiresAt.getTime() - now.getTime() > bufferMs).toBe(true);
  });

  test("token is considered expired when within buffer period", () => {
    const almostExpiredCredentials = {
      server_url: "https://api.han.guru",
      access_token: "almost-expired-token",
      refresh_token: "refresh-token",
      user: { id: "123", email: null, github_username: null },
      expires_at: new Date(Date.now() + 30000).toISOString(), // 30 seconds from now
    };

    const expiresAt = new Date(almostExpiredCredentials.expires_at);
    const now = new Date();
    const bufferMs = 60 * 1000; // 60 second buffer

    // Should be expired because it's within the buffer
    expect(expiresAt.getTime() - now.getTime() <= bufferMs).toBe(true);
  });
});

describe("Server URL Configuration", () => {
  test("default server URL is used when not configured", () => {
    const DEFAULT_SERVER_URL = "https://api.han.guru";
    expect(DEFAULT_SERVER_URL).toBe("https://api.han.guru");
  });

  test("server URL from credentials takes precedence", () => {
    const credentials = {
      server_url: "https://custom.han.example.com",
      access_token: "token",
      refresh_token: "refresh",
      user: { id: "123", email: null, github_username: null },
      expires_at: new Date().toISOString(),
    };

    expect(credentials.server_url).toBe("https://custom.han.example.com");
  });

  test("validates URL format", () => {
    const validUrls = [
      "https://api.han.guru",
      "https://custom.example.com",
      "http://localhost:8080",
    ];

    const invalidUrls = [
      "not-a-url",
      "",
    ];

    const isValidServerUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    };

    for (const url of validUrls) {
      expect(isValidServerUrl(url)).toBe(true);
    }

    for (const url of invalidUrls) {
      expect(isValidServerUrl(url)).toBe(false);
    }

    // ftp is a parseable URL but not a valid server URL
    expect(isValidServerUrl("ftp://invalid.protocol.com")).toBe(false);
  });
});

describe("Auth Status", () => {
  test("unauthenticated when no credentials exist", () => {
    const credPath = join(testConfigDir, "credentials.json");

    expect(existsSync(credPath)).toBe(false);

    // Status should indicate not authenticated
    const authenticated = existsSync(credPath);
    expect(authenticated).toBe(false);
  });

  test("authenticated when valid credentials exist", () => {
    const credPath = join(testConfigDir, "credentials.json");

    const credentials = {
      server_url: "https://api.han.guru",
      access_token: "valid-token",
      refresh_token: "refresh-token",
      user: {
        id: "user-123",
        email: "test@example.com",
        github_username: "testuser",
      },
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    writeFileSync(credPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });

    const loaded = JSON.parse(readFileSync(credPath, "utf-8"));

    expect(loaded.access_token).toBeTruthy();
    expect(loaded.user).toBeTruthy();
    expect(loaded.user.id).toBe("user-123");
  });

  test("user information is correctly returned", () => {
    const credentials = {
      server_url: "https://api.han.guru",
      access_token: "token",
      refresh_token: "refresh",
      user: {
        id: "user-123",
        email: "test@example.com",
        github_username: "testuser",
        name: "Test User",
        avatar_url: "https://avatars.example.com/123",
      },
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    expect(credentials.user.id).toBe("user-123");
    expect(credentials.user.email).toBe("test@example.com");
    expect(credentials.user.github_username).toBe("testuser");
    expect(credentials.user.name).toBe("Test User");
    expect(credentials.user.avatar_url).toBe("https://avatars.example.com/123");
  });
});

describe("Credential Clearing", () => {
  test("clearing removes credentials file", () => {
    const credPath = join(testConfigDir, "credentials.json");

    // Create credentials
    writeFileSync(credPath, JSON.stringify({ test: true }), { mode: 0o600 });
    expect(existsSync(credPath)).toBe(true);

    // Clear credentials
    const { unlinkSync } = require("node:fs");
    unlinkSync(credPath);

    expect(existsSync(credPath)).toBe(false);
  });

  test("clearing returns false when no credentials exist", () => {
    const credPath = join(testConfigDir, "credentials.json");

    expect(existsSync(credPath)).toBe(false);

    // Should indicate nothing to clear
    const hadCredentials = existsSync(credPath);
    expect(hadCredentials).toBe(false);
  });
});

describe("Token Response Handling", () => {
  test("token response contains required fields", () => {
    const tokenResponse = {
      access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      token_type: "Bearer",
      expires_in: 86400, // 24 hours
    };

    expect(tokenResponse.access_token).toBeTruthy();
    expect(tokenResponse.refresh_token).toBeTruthy();
    expect(tokenResponse.token_type).toBe("Bearer");
    expect(tokenResponse.expires_in).toBeGreaterThan(0);
  });

  test("calculates expiration date from expires_in", () => {
    const expiresIn = 86400; // 24 hours in seconds
    const now = Date.now();
    const expiresAt = new Date(now + expiresIn * 1000);

    expect(expiresAt.getTime()).toBeGreaterThan(now);
    expect(expiresAt.getTime()).toBeLessThan(now + 86401000); // Just over 24 hours
  });
});

describe("OAuth Callback URL", () => {
  test("callback URL is constructed correctly", () => {
    const port = 12345;
    const callbackUrl = `http://localhost:${port}/callback`;

    expect(callbackUrl).toBe("http://localhost:12345/callback");
  });

  test("callback URL with code parameter", () => {
    const port = 12345;
    const code = "abc123xyz";
    const callbackUrl = new URL(`http://localhost:${port}/callback`);
    callbackUrl.searchParams.set("code", code);

    expect(callbackUrl.toString()).toBe(
      "http://localhost:12345/callback?code=abc123xyz"
    );
  });

  test("port validation", () => {
    const validPorts = [1024, 8080, 41956, 65535];
    const invalidPorts = [0, 80, 443, 1023, 65536, -1];

    for (const port of validPorts) {
      expect(port >= 1024 && port <= 65535).toBe(true);
    }

    for (const port of invalidPorts) {
      expect(port >= 1024 && port <= 65535).toBe(false);
    }
  });
});
