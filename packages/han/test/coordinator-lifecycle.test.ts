import { describe, expect, it } from "bun:test";
import {
	COORDINATOR_VERSION,
	checkClientVersion,
	getCoordinatorVersion,
	isCoordinatorInstance,
} from "../lib/services/coordinator-service.ts";

describe("Coordinator Lifecycle", () => {
	it("reports version from package.json", () => {
		const version = getCoordinatorVersion();
		expect(version).toMatch(/^\d+\.\d+\.\d+/);
	});

	it("COORDINATOR_VERSION matches getCoordinatorVersion", () => {
		expect(COORDINATOR_VERSION).toBe(getCoordinatorVersion());
	});

	it("isCoordinatorInstance returns false initially", () => {
		expect(isCoordinatorInstance()).toBe(false);
	});

	it("checkClientVersion returns false when not running", () => {
		expect(checkClientVersion("999.0.0")).toBe(false);
	});
});
