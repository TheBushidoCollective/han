import { afterEach, describe, expect, test } from "bun:test";
import { bootstrapDashboard, dashboardAuthorization } from "./bootstrap.ts";
import { getGraphQLEndpoints } from "./config/urls.ts";

const original = new Map<string, PropertyDescriptor | undefined>();
function install(name: string, value: unknown) {
	if (!original.has(name))
		original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
	Object.defineProperty(globalThis, name, {
		value,
		configurable: true,
		writable: true,
	});
}
afterEach(() => {
	for (const [name, descriptor] of original) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
	original.clear();
});

function browser(hash: string, host = "127.0.0.1:41956") {
	const url = new URL(
		`http://${host}/?coordinatorUrl=https://evil.example/graphql&coordinatorPort=3${hash}`,
	);
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
		removeItem: (key: string) => {
			values.delete(key);
		},
	};
	install("location", url);
	install("window", { location: url });
	install("sessionStorage", storage);
	install("history", {
		replaceState: (_state: unknown, _title: string, path: string) => {
			url.hash = "";
			expect(path).not.toContain("launchToken");
		},
	});
	return { url, storage };
}

describe("local dashboard bootstrap", () => {
	test("scrubs capability before exchange, stores session and ignores endpoint overrides", async () => {
		const { url } = browser("#launchToken=one-use");
		install("fetch", async (input: string, init: RequestInit) => {
			expect(url.hash).toBe("");
			expect(input).toBe("/_han/session");
			expect(JSON.parse(String(init.body))).toEqual({
				transportVersion: 1,
				launchToken: "one-use",
			});
			return Response.json({ accessToken: "dashboard-token" });
		});
		await bootstrapDashboard();
		expect(dashboardAuthorization()).toEqual({
			Authorization: "Bearer dashboard-token",
		});
		expect(getGraphQLEndpoints()).toEqual({
			http: "http://127.0.0.1:41956/graphql",
			ws: "ws://127.0.0.1:41956/graphql",
		});
		await bootstrapDashboard();
	});

	test("rejects a public origin without sending the capability", async () => {
		const { url } = browser("#launchToken=secret", "public.example:41956");
		install("fetch", () => {
			throw new Error("must not fetch");
		});
		await expect(bootstrapDashboard()).rejects.toThrow("han browse");
		expect(url.hash).toBe("");
	});

	test("rejects a failed exchange rather than retaining an old session", async () => {
		const { storage } = browser("#launchToken=expired");
		storage.setItem("han.dashboard.accessToken", "old");
		install("fetch", async () => new Response(null, { status: 401 }));
		await expect(bootstrapDashboard()).rejects.toThrow("expired");
		expect(storage.getItem("han.dashboard.accessToken")).toBeNull();
	});
});
