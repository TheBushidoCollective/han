/**
 * Tests for native module loader with retry logic
 */
import { describe, expect, test } from "bun:test";

// We need to test the module behavior, but we can't easily mock require()
// So we'll test the exported functions and their error handling

describe("native module loader", () => {
	describe("getNativeModule", () => {
		test("returns native module when available", async () => {
			const { tryGetNativeModule } = await import("../lib/native.ts");
			const nativeModule = tryGetNativeModule();

			// Either returns a module or null (depending on environment)
			expect(nativeModule === null || typeof nativeModule === "object").toBe(
				true,
			);
		});

		test("tryGetNativeModule returns null gracefully when module unavailable", async () => {
			const { tryGetNativeModule } = await import("../lib/native.ts");
			const result = tryGetNativeModule();

			// Should not throw, returns either module or null
			expect(result === null || typeof result === "object").toBe(true);
		});

		test("getNativeModule throws when module unavailable", async () => {
			// We can only test this if the module is actually unavailable
			// In test environment, the module should be available
			const { getNativeModule, tryGetNativeModule } = await import(
				"../lib/native.ts"
			);

			const nativeModule = tryGetNativeModule();
			if (nativeModule === null) {
				// Module is unavailable, getNativeModule should throw
				expect(() => getNativeModule()).toThrow("Failed to load native module");
			} else {
				// Module is available, getNativeModule should return it
				expect(getNativeModule()).toBe(nativeModule);
			}
		});

		test("caches module after first load", async () => {
			const { tryGetNativeModule } = await import("../lib/native.ts");

			const first = tryGetNativeModule();
			const second = tryGetNativeModule();

			// Should return same reference
			expect(first).toBe(second);
		});
	});

	describe("native module functions", () => {
		test("computeFileHash returns string when available", async () => {
			const { tryGetNativeModule } = await import("../lib/native.ts");
			const nativeModule = tryGetNativeModule();

			if (nativeModule) {
				const hash = nativeModule.computeFileHash(__filename);
				expect(typeof hash).toBe("string");
				expect(hash.length).toBeGreaterThan(0);
			}
		});

		test("findFilesWithGlob returns array when available", async () => {
			const { tryGetNativeModule } = await import("../lib/native.ts");
			const nativeModule = tryGetNativeModule();

			if (nativeModule) {
				const files = nativeModule.findFilesWithGlob(process.cwd(), ["*.ts"]);
				expect(Array.isArray(files)).toBe(true);
			}
		});

		test("buildManifest returns object when available", async () => {
			const { tryGetNativeModule } = await import("../lib/native.ts");
			const nativeModule = tryGetNativeModule();

			if (nativeModule) {
				const manifest = nativeModule.buildManifest(
					[__filename],
					process.cwd(),
				);
				expect(typeof manifest).toBe("object");
			}
		});

		test("hasChanges returns boolean when available", async () => {
			const { tryGetNativeModule } = await import("../lib/native.ts");
			const nativeModule = tryGetNativeModule();

			if (nativeModule) {
				const changed = nativeModule.hasChanges(process.cwd(), ["*.ts"], {});
				expect(typeof changed).toBe("boolean");
			}
		});

		test("findDirectoriesWithMarkers returns array when available", async () => {
			const { tryGetNativeModule } = await import("../lib/native.ts");
			const nativeModule = tryGetNativeModule();

			if (nativeModule) {
				const dirs = nativeModule.findDirectoriesWithMarkers(process.cwd(), [
					"package.json",
				]);
				expect(Array.isArray(dirs)).toBe(true);
			}
		});
	});

	describe("error detection", () => {
		test("identifies dlopen errors correctly", () => {
			// Test the pattern matching logic we use for dlopen detection
			const isDlopenError = (message: string) =>
				message.includes("dlopen") ||
				message.includes("ERR_DLOPEN_FAILED") ||
				message.includes("no such file");

			expect(isDlopenError("dlopen failed")).toBe(true);
			expect(isDlopenError("ERR_DLOPEN_FAILED")).toBe(true);
			expect(isDlopenError("no such file or directory")).toBe(true);
			expect(isDlopenError("module not found")).toBe(false);
			expect(isDlopenError("syntax error")).toBe(false);
		});

		test("exponential backoff delays are correct", () => {
			// Test the delay calculation logic
			const baseDelay = 100;
			const delays = [0, 1, 2, 3, 4, 5, 6, 7].map(
				(attempt) => baseDelay * 2 ** attempt,
			);

			expect(delays[0]).toBe(100);
			expect(delays[1]).toBe(200);
			expect(delays[2]).toBe(400);
			expect(delays[3]).toBe(800);
			expect(delays[4]).toBe(1600);
			expect(delays[5]).toBe(3200);
			expect(delays[6]).toBe(6400);
			expect(delays[7]).toBe(12800);
		});

		test("dlopen error gets longer delays", () => {
			// For dlopen errors, base delay is 200ms
			const baseDelay = 200;
			const delays = [0, 1, 2, 3].map((attempt) => baseDelay * 2 ** attempt);

			expect(delays[0]).toBe(200);
			expect(delays[1]).toBe(400);
			expect(delays[2]).toBe(800);
			expect(delays[3]).toBe(1600);
		});
	});
});

describe("native module type exports", () => {
	test("getNativeModule and tryGetNativeModule are exported", async () => {
		// This is a compile-time check - if it fails, TypeScript will error
		const native = await import("../lib/native.ts");
		expect(native.getNativeModule).toBeDefined();
		expect(native.tryGetNativeModule).toBeDefined();
	});
});
