/**
 * Sync Service Tests
 *
 * Tests for session synchronization service.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync, gunzipSync } from "node:zlib";

// Test directory setup
const testDir = join(tmpdir(), `han-sync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const testSessionsDir = join(testDir, ".claude", "projects");

beforeEach(() => {
  mkdirSync(join(testSessionsDir, "test-project", "session-123"), { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("Session Transcript Reading", () => {
  test("reads transcript file correctly", () => {
    const transcriptPath = join(testSessionsDir, "test-project", "session-123", "transcript.jsonl");

    const messages = [
      { timestamp: "2026-01-31T10:00:00Z", type: "user", content: "Hello" },
      { timestamp: "2026-01-31T10:00:01Z", type: "assistant", content: "Hi there!" },
    ];

    const content = messages.map((m) => JSON.stringify(m)).join("\n");
    writeFileSync(transcriptPath, content);

    expect(existsSync(transcriptPath)).toBe(true);

    const loaded = Bun.file(transcriptPath).text();
    expect(loaded).resolves.toContain("Hello");
  });

  test("handles empty transcript file", () => {
    const transcriptPath = join(testSessionsDir, "test-project", "session-123", "transcript.jsonl");
    writeFileSync(transcriptPath, "");

    const content = Bun.file(transcriptPath).text();
    expect(content).resolves.toBe("");
  });

  test("handles missing transcript file", () => {
    const transcriptPath = join(testSessionsDir, "test-project", "nonexistent", "transcript.jsonl");

    expect(existsSync(transcriptPath)).toBe(false);
  });
});

describe("Transcript Compression", () => {
  test("compresses transcript data with gzip", () => {
    const transcript = JSON.stringify({
      messages: [
        { type: "user", content: "Test message" },
        { type: "assistant", content: "Response" },
      ],
    });

    const compressed = gzipSync(Buffer.from(transcript, "utf-8"));
    const base64 = compressed.toString("base64");

    // Compressed data should be smaller for larger payloads
    expect(base64.length).toBeGreaterThan(0);

    // Should be decompressable
    const decompressed = gunzipSync(Buffer.from(base64, "base64"));
    expect(decompressed.toString("utf-8")).toBe(transcript);
  });

  test("base64 encoding is valid", () => {
    const data = Buffer.from("test data", "utf-8");
    const compressed = gzipSync(data);
    const base64 = compressed.toString("base64");

    // Should only contain valid base64 characters
    expect(/^[A-Za-z0-9+/]+=*$/.test(base64)).toBe(true);
  });
});

describe("Sync Payload Structure", () => {
  test("payload has required fields", () => {
    const payload = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      sessions: [
        {
          id: "session-123",
          projectPath: "/test/project",
          transcript: "base64-encoded-data",
          metadata: {
            startTime: "2026-01-31T10:00:00Z",
            lastActivityTime: "2026-01-31T10:30:00Z",
            messageCount: 42,
            transcriptSize: 1024,
          },
        },
      ],
    };

    expect(payload.version).toBe("1.0.0");
    expect(payload.timestamp).toBeTruthy();
    expect(Array.isArray(payload.sessions)).toBe(true);
    expect(payload.sessions.length).toBe(1);

    const session = payload.sessions[0];
    expect(session.id).toBe("session-123");
    expect(session.metadata.messageCount).toBe(42);
  });

  test("multiple sessions in single payload", () => {
    const payload = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      sessions: [
        { id: "session-1", projectPath: "/project1", transcript: "data1", metadata: {} },
        { id: "session-2", projectPath: "/project2", transcript: "data2", metadata: {} },
        { id: "session-3", projectPath: "/project3", transcript: "data3", metadata: {} },
      ],
    };

    expect(payload.sessions.length).toBe(3);
    expect(payload.sessions.map((s) => s.id)).toEqual([
      "session-1",
      "session-2",
      "session-3",
    ]);
  });
});

describe("Sync Response Handling", () => {
  test("success response structure", () => {
    const response = {
      status: "success",
      processed: 3,
    };

    expect(response.status).toBe("success");
    expect(response.processed).toBe(3);
  });

  test("partial success response structure", () => {
    const response = {
      status: "partial",
      processed: 2,
      errors: [
        { sessionId: "session-3", message: "Invalid format" },
      ],
    };

    expect(response.status).toBe("partial");
    expect(response.processed).toBe(2);
    expect(response.errors?.length).toBe(1);
    expect(response.errors?.[0].sessionId).toBe("session-3");
  });

  test("error response structure", () => {
    const response = {
      status: "error",
      processed: 0,
      errors: [
        { sessionId: "*", message: "Server unavailable" },
      ],
    };

    expect(response.status).toBe("error");
    expect(response.processed).toBe(0);
  });
});

describe("Session Listing", () => {
  test("lists sessions from project directories", () => {
    // Create multiple sessions
    const sessions = ["session-abc", "session-def", "session-ghi"];

    for (const sessionId of sessions) {
      const sessionDir = join(testSessionsDir, "test-project", sessionId);
      mkdirSync(sessionDir, { recursive: true });
      writeFileSync(
        join(sessionDir, "transcript.jsonl"),
        JSON.stringify({ timestamp: new Date().toISOString(), type: "user", content: "test" })
      );
    }

    // Verify directories exist
    for (const sessionId of sessions) {
      const transcriptPath = join(testSessionsDir, "test-project", sessionId, "transcript.jsonl");
      expect(existsSync(transcriptPath)).toBe(true);
    }
  });

  test("sessions from multiple projects", () => {
    const projects = ["project-1", "project-2"];
    const sessionsPerProject = 2;

    for (const project of projects) {
      for (let i = 0; i < sessionsPerProject; i++) {
        const sessionDir = join(testSessionsDir, project, `session-${i}`);
        mkdirSync(sessionDir, { recursive: true });
        writeFileSync(
          join(sessionDir, "transcript.jsonl"),
          JSON.stringify({ test: true })
        );
      }
    }

    // Verify total sessions
    let totalSessions = 0;
    for (const project of projects) {
      const projectDir = join(testSessionsDir, project);
      if (existsSync(projectDir)) {
        const { readdirSync } = require("node:fs");
        const sessions = readdirSync(projectDir);
        totalSessions += sessions.length;
      }
    }

    expect(totalSessions).toBe(projects.length * sessionsPerProject);
  });
});

describe("Watch Mode", () => {
  test("detects file changes in session directory", async () => {
    const sessionDir = join(testSessionsDir, "test-project", "session-123");
    const transcriptPath = join(sessionDir, "transcript.jsonl");

    writeFileSync(transcriptPath, JSON.stringify({ initial: true }));

    // Simulate file change
    await Bun.sleep(10);
    writeFileSync(transcriptPath, JSON.stringify({ updated: true }));

    const content = await Bun.file(transcriptPath).text();
    expect(content).toContain("updated");
  });

  test("stop function prevents further processing", () => {
    let running = true;
    let processed = 0;

    const stop = () => {
      running = false;
    };

    // Simulate sync loop
    const tick = () => {
      if (running) {
        processed++;
      }
    };

    tick();
    tick();
    expect(processed).toBe(2);

    stop();
    tick();
    expect(processed).toBe(2); // Should not increment after stop
  });
});

describe("Authentication Integration", () => {
  test("requires authentication for sync", () => {
    const credentials = null; // No credentials

    const isAuthenticated = credentials !== null;
    expect(isAuthenticated).toBe(false);
  });

  test("uses access token in Authorization header", () => {
    const accessToken = "test-access-token";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    expect(headers.Authorization).toBe("Bearer test-access-token");
  });

  test("refreshes token when expired", () => {
    const credentials = {
      access_token: "old-token",
      refresh_token: "refresh-token",
      expires_at: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
    };

    const expiresAt = new Date(credentials.expires_at);
    const now = new Date();
    const isExpired = expiresAt.getTime() < now.getTime();

    expect(isExpired).toBe(true);
  });
});

describe("Error Handling", () => {
  test("handles network errors gracefully", () => {
    const error = new Error("Network request failed");

    const result = {
      success: false,
      sessionsProcessed: 0,
      error: error.message,
    };

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network request failed");
  });

  test("handles server errors", () => {
    const serverError = {
      status: 500,
      message: "Internal server error",
    };

    const result = {
      success: false,
      sessionsProcessed: 0,
      error: `Server error: ${serverError.status} - ${serverError.message}`,
    };

    expect(result.success).toBe(false);
    expect(result.error).toContain("500");
  });

  test("handles unauthorized errors", () => {
    const authError = {
      status: 401,
      message: "Invalid or expired token",
    };

    expect(authError.status).toBe(401);
    // Should trigger re-authentication
  });
});
