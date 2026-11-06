import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
	appendFile,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type WebSocket as BrowserSocket,
	expect,
	type Page,
	test,
} from "@playwright/test";

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(clientDir, "../han/lib/main.ts");
const bun = process.env.HAN_TRANSPORT_BUN || "bun";
const coordinatorBinary = resolve(
	clientDir,
	"../han-rs/target/release/han-coordinator",
);

interface Gateway {
	child: ChildProcess;
	url: string;
	launcher: string;
	launchToken: string;
}
const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

async function until(
	predicate: () => boolean | Promise<boolean>,
	label: string,
	timeout = 45_000,
) {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await predicate()) return;
		await sleep(100);
	}
	throw new Error(`Timed out waiting for ${label}`);
}

async function command(
	args: string[],
	env: NodeJS.ProcessEnv,
): Promise<number | null> {
	const child = spawn(bun, [cli, ...args], {
		cwd: env.HOME,
		env,
		stdio: "ignore",
	});
	return await new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", resolve);
	});
}

async function launch(env: NodeJS.ProcessEnv): Promise<Gateway> {
	const child = spawn(
		bun,
		[cli, "browse", "--local", "--no-open", "--port", "0"],
		{
			cwd: env.HOME,
			env,
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	let output = "";
	child.stdout?.on("data", (chunk) => {
		output += chunk.toString();
	});
	// Drain stderr without exposing local paths, credentials, or frames in reports.
	child.stderr?.on("data", () => {});
	let failure: Error | undefined;
	child.once("error", (error) => {
		failure = error;
	});
	try {
		await until(
			() => {
				if (failure || child.exitCode !== null)
					throw new Error("Browse CLI exited before publishing its launcher");
				return (
					/Launcher: (file:\/\/\S+)/.test(output) &&
					/gateway listening at (http:\/\/127\.0\.0\.1:\d+)/.test(output)
				);
			},
			"CLI launcher",
			150_000,
		);
		const launcher = output.match(/Launcher: (file:\/\/\S+)/)![1];
		const url = output.match(
			/gateway listening at (http:\/\/127\.0\.0\.1:\d+)/,
		)![1];
		const html = await readFile(fileURLToPath(launcher), "utf8");
		const destination = JSON.parse(
			html.match(/location\.replace\(("[^"]+")\)/)![1],
		) as string;
		const launchToken = new URLSearchParams(
			new URL(destination).hash.slice(1),
		).get("launchToken");
		if (!launchToken || new URL(destination).origin !== url)
			throw new Error("Invalid CLI launcher destination");
		return { child, url, launcher, launchToken };
	} catch (error) {
		child.kill("SIGTERM");
		throw error;
	}
}

async function terminate(child: ChildProcess) {
	if (child.exitCode !== null || child.signalCode !== null) return;
	const done = new Promise<void>((resolve) =>
		child.once("exit", () => resolve()),
	);
	child.kill("SIGTERM");
	await Promise.race([done, sleep(10_000)]);
	if (child.exitCode === null && child.signalCode === null) {
		child.kill("SIGKILL");
		await done;
	}
}

async function request(
	url: string,
	path: string,
	headers: Record<string, string>,
	body: unknown,
) {
	return await new Promise<number>((resolve, reject) => {
		const req = http.request(
			`${url}${path}`,
			{
				method: "POST",
				headers: { "content-type": "application/json", ...headers },
			},
			(res) => {
				res.resume();
				res.on("end", () => resolve(res.statusCode ?? 0));
			},
		);
		req.on("error", reject);
		req.end(JSON.stringify(body));
	});
}

function observe(page: Page) {
	const subscriptions = new Set<string>();
	const events: Array<{ field: string; sessionId: string }> = [];
	let acknowledged = false;
	let closed = false;
	page.on("websocket", (socket: BrowserSocket) => {
		if (!socket.url().endsWith("/graphql")) return;
		let carriesUiSubscription = false;
		socket.on("framesent", ({ payload }) => {
			try {
				const frame = JSON.parse(String(payload));
				if (frame.type === "subscribe") {
					const query = String(frame.payload?.query ?? "");
					if (query.includes("SessionsContentSubscription")) {
						subscriptions.add("sessions");
						carriesUiSubscription = true;
					}
					if (query.includes("SessionMessagesSubscription")) {
						subscriptions.add("messages");
						carriesUiSubscription = true;
					}
				}
			} catch {
				/* Ignore non-JSON frames. */
			}
		});
		socket.on("framereceived", ({ payload }) => {
			try {
				const frame = JSON.parse(String(payload));
				if (frame.type === "connection_ack") acknowledged = true;
				for (const field of ["sessionAdded", "sessionMessageAdded"]) {
					const value = frame.payload?.data?.[field];
					if (value?.sessionId)
						events.push({ field, sessionId: value.sessionId });
				}
			} catch {
				/* Ignore non-JSON frames. */
			}
		});
		socket.on("close", () => {
			if (carriesUiSubscription) closed = true;
		});
		socket.on("socketerror", () => {
			if (carriesUiSubscription) closed = true;
		});
	});
	return {
		subscriptions,
		events,
		acknowledged: () => acknowledged,
		closed: () => closed,
	};
}

function line(sessionId: string, content: string) {
	return `${JSON.stringify({ type: "user", uuid: randomUUID(), sessionId, timestamp: new Date().toISOString(), message: { role: "user", content } })}\n`;
}

test("real launcher, gateway and live GraphQL subscriptions with security controls", async ({
	browser,
}) => {
	const home = await mkdtemp(join(tmpdir(), "han-transport-"));
	const projectDir = join(home, ".claude", "projects", "-transport-proof");
	const dataDir = join(home, ".han");
	await mkdir(projectDir, { recursive: true });
	const env: NodeJS.ProcessEnv = {
		...process.env,
		HOME: home,
		USERPROFILE: home,
		HAN_DATA_DIR: dataDir,
		CLAUDE_CONFIG_DIR: join(home, ".claude"),
		NODE_ENV: "production",
		HAN_COORDINATOR_PORT: "0",
		CLAUDE_CODE_ENABLE_TELEMETRY: "0",
	};
	delete env.HAN_COORDINATOR_DAEMON;
	delete env.HAN_BINARY_PATH;
	delete env.HAN_BINARY;
	delete env.HAN_REEXEC;
	env.CLAUDE_PROJECT_DIR = home;
	let gateway: Gateway | undefined;
	let brokenGateway: Gateway | undefined;
	let coordinator: ChildProcess | undefined;
	const context = await browser.newContext();
	const page = await context.newPage();
	const observed = observe(page);
	try {
		coordinator = spawn(
			coordinatorBinary,
			[
				"--foreground",
				"--port",
				"0",
				"--grpc-port",
				"0",
				"--data-dir",
				dataDir,
			],
			{
				cwd: home,
				env: { ...env, RUST_LOG: "info" },
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		let coordinatorOutput = "";
		coordinator.stdout?.on("data", (chunk) => {
			coordinatorOutput += chunk.toString();
		});
		coordinator.stderr?.on("data", (chunk) => {
			coordinatorOutput += chunk.toString();
		});
		let coordinatorFailure: Error | undefined;
		coordinator.once("error", (error) => {
			coordinatorFailure = error;
		});
		await until(
			() => {
				if (coordinatorFailure || coordinator?.exitCode !== null)
					throw new Error("Coordinator exited before watcher readiness");
				return coordinatorOutput.includes("Watcher bridge started");
			},
			"coordinator watcher readiness",
			90_000,
		);
		gateway = await launch(env);
		const { url, launcher, launchToken } = gateway;
		const exchange = { transportVersion: 1, launchToken };
		const sameOrigin = { origin: url, "sec-fetch-site": "same-origin" };
		expect(
			await request(url, "/_han/session", sameOrigin, {
				...exchange,
				launchToken: "invalid",
			}),
		).toBe(401);
		const exchangeResponse = page.waitForResponse(
			(response) =>
				response.url() === `${url}/_han/session` && response.status() === 200,
		);
		const graphResponse = page.waitForResponse(
			(response) =>
				response.url() === `${url}/graphql` &&
				response.request().method() === "POST" &&
				response.status() === 200,
		);
		await page.goto(launcher);
		await exchangeResponse;
		const graph = await graphResponse;
		const graphBody = await graph.json();
		expect(graphBody.data).toBeTruthy();
		expect(graphBody.errors).toBeUndefined();
		await expect
			.poll(() => page.url())
			.toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${new URL(url).port}/`));
		await expect.poll(() => new URL(page.url()).hash).toBe("");
		const token = await page.evaluate(() =>
			sessionStorage.getItem("han.dashboard.accessToken"),
		);
		expect(token).toBeTruthy();
		expect(await request(url, "/_han/session", sameOrigin, exchange)).toBe(401);
		const query = { query: "query { __typename }" };
		const valid = { ...sameOrigin, authorization: `Bearer ${token}` };
		expect(
			await request(
				url,
				"/graphql",
				{ ...valid, authorization: "Bearer wrong" },
				query,
			),
		).toBe(401);
		expect(
			await request(
				url,
				"/graphql",
				{ ...valid, origin: "http://example.invalid" },
				query,
			),
		).toBe(403);
		expect(
			await request(url, "/graphql", { ...valid, host: "localhost" }, query),
		).toBe(421);
		expect(
			await request(
				url,
				"/graphql",
				{ ...valid, "sec-fetch-site": "cross-site" },
				query,
			),
		).toBe(403);
		expect(await request(url, "/graphql", valid, query)).toBe(200);
		const closeCode = await page.evaluate(
			async () =>
				await new Promise<number>((resolve) => {
					const ws = new WebSocket(
						`ws://${location.host}/graphql`,
						"graphql-transport-ws",
					);
					ws.onopen = () =>
						ws.send(
							JSON.stringify({
								type: "connection_init",
								payload: { authorization: "Bearer wrong" },
							}),
						);
					ws.onclose = (event) => resolve(event.code);
					ws.onerror = () => resolve(0);
				}),
		);
		expect(closeCode).toBe(4401);
		await page
			.getByRole("link", { name: /sessions/i })
			.first()
			.click();
		await expect(page).toHaveURL(/\/sessions$/);
		await until(
			() => observed.acknowledged() && observed.subscriptions.has("sessions"),
			"sessions subscription",
		);
		let navigations = 0;
		page.on("framenavigated", (frame) => {
			if (frame === page.mainFrame()) navigations++;
		});
		const id = randomUUID();
		const transcript = join(projectDir, `${id}.jsonl`);
		await writeFile(transcript, line(id, `transport initial ${id}`));
		await until(
			() =>
				observed.events.some(
					(event) => event.field === "sessionAdded" && event.sessionId === id,
				),
			"sessionAdded payload",
		);
		const session = page.locator(`a[href="/sessions/${id}"]`);
		await expect(session).toBeVisible();
		expect(navigations).toBe(0);
		await session.click();
		await until(
			() => observed.subscriptions.has("messages"),
			"detail subscription",
		);
		const navAtDetail = navigations;
		const message = `transport appended ${randomUUID()}`;
		await appendFile(transcript, line(id, message));
		await until(
			() =>
				observed.events.some(
					(event) =>
						event.field === "sessionMessageAdded" && event.sessionId === id,
				),
			"sessionMessageAdded payload",
		);
		await expect(page.getByText(message, { exact: false })).toBeVisible();
		expect(navigations).toBe(navAtDetail);

		// A second disposable gateway supplies a fresh one-use launcher. Only this
		// negative-control context intercepts WebSockets; HTTP remains real.
		brokenGateway = await launch(env);
		const broken = await browser.newContext();
		try {
			let interrupted = false;
			await broken.routeWebSocket(/\/graphql$/, (socket) => {
				interrupted = true;
				socket.close({ code: 1011, reason: "deliberate interruption" });
			});
			const brokenPage = await broken.newPage();
			await brokenPage.goto(brokenGateway.launcher);
			await brokenPage
				.getByRole("link", { name: /sessions/i })
				.first()
				.click();
			await expect(brokenPage).toHaveURL(/\/sessions$/);
			const brokenToken = await brokenPage.evaluate(() =>
				sessionStorage.getItem("han.dashboard.accessToken"),
			);
			expect(
				await request(
					brokenGateway.url,
					"/graphql",
					{
						origin: brokenGateway.url,
						"sec-fetch-site": "same-origin",
						authorization: `Bearer ${brokenToken}`,
					},
					query,
				),
			).toBe(200);
			await until(() => interrupted, "deliberately interrupted WebSocket");
			await brokenPage.locator(`a[href="/sessions/${id}"]`).click();
			await expect(
				brokenPage.getByText(message, { exact: false }),
			).toBeVisible();
			const messageCount = async () =>
				await brokenPage.evaluate(async (sessionId) => {
					const authorization = sessionStorage.getItem(
						"han.dashboard.accessToken",
					);
					const response = await fetch("/graphql", {
						method: "POST",
						headers: {
							"content-type": "application/json",
							authorization: `Bearer ${authorization}`,
						},
						body: JSON.stringify({
							query:
								"query($id: String!) { session(id: $id) { messageCount } }",
							variables: { id: sessionId },
						}),
					});
					const result = await response.json();
					if (
						!response.ok ||
						result.errors ||
						typeof result.data?.session?.messageCount !== "number"
					) {
						throw new Error("Negative-control session query failed");
					}
					return result.data.session.messageCount as number;
				}, id);
			const before = await messageCount();
			const withheld = `transport withheld ${randomUUID()}`;
			await appendFile(transcript, line(id, withheld));
			await until(
				async () => (await messageCount()) > before,
				"negative message indexed over real HTTP",
			);
			await sleep(3_000);
			await expect(
				brokenPage.getByText(withheld, { exact: false }),
			).not.toBeVisible();
		} finally {
			await broken.close();
		}

		expect(await command(["coordinator", "stop"], env)).toBe(0);
		await until(
			() => observed.closed(),
			"subscription closure after owned coordinator stop",
		);
		expect(await request(url, "/graphql", valid, query)).toBe(502);
	} finally {
		await context.close();
		if (brokenGateway) await terminate(brokenGateway.child);
		if (gateway) await terminate(gateway.child);
		await command(["coordinator", "stop"], env);
		if (coordinator) await terminate(coordinator);
		await rm(home, { recursive: true, force: true });
	}
});
