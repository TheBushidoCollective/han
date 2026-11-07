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
	type Browser,
	type WebSocket as BrowserSocket,
	expect,
	type Page,
	test,
} from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(clientDir, "../han/lib/main.ts");
const bun = process.env.HAN_TRANSPORT_BUN || "bun";
const coordinatorBinary =
	process.env.HAN_TRANSPORT_COORDINATOR ||
	resolve(clientDir, "../han-rs/target/release/han-coordinator");

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
	let diagnostic = "";
	child.stderr?.on("data", (chunk) => {
		diagnostic = `${diagnostic}${chunk.toString()}`.slice(-4000);
	});
	let failure: Error | undefined;
	child.once("error", (error) => {
		failure = error;
	});
	try {
		await until(
			() => {
				if (failure || child.exitCode !== null) {
					const safe = diagnostic
						.replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
						.replace(/launchToken=[^\s"'&]+/gi, "launchToken=[redacted]")
						.replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]");
					throw new Error(
						`Browse CLI exited before publishing its launcher: ${safe}`,
					);
				}
				return (
					/Launcher: (file:\/\/\S+)/.test(output) &&
					/gateway listening at (http:\/\/127\.0\.0\.1:\d+)/.test(output)
				);
			},
			"CLI launcher",
			150_000,
		);
		const launcher = output.match(/Launcher: (file:\/\/\S+)/)?.[1];
		const url = output.match(
			/gateway listening at (http:\/\/127\.0\.0\.1:\d+)/,
		)?.[1];
		if (!launcher || !url) throw new Error("CLI launcher output disappeared");
		const html = await readFile(fileURLToPath(launcher), "utf8");
		const encodedDestination = html.match(
			/location\.replace\(("[^"]+")\)/,
		)?.[1];
		if (!encodedDestination) throw new Error("Invalid CLI launcher document");
		const destination = JSON.parse(encodedDestination) as string;
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

async function rawStatus(
	url: string,
	path: string,
	method: string,
	headers: Record<string, string>,
) {
	const { promise, resolve, reject } = Promise.withResolvers<number>();
	const req = http.request(`${url}${path}`, { method, headers }, (res) => {
		res.resume();
		res.on("end", () => resolve(res.statusCode ?? 0));
	});
	req.on("upgrade", (_res, socket) => {
		socket.destroy();
		resolve(101);
	});
	req.on("error", reject);
	req.end();
	return await promise;
}

async function attackerControls(browser: Browser, url: string, token: string) {
	const server = http.createServer((_req, res) => {
		res.writeHead(200, { "content-type": "text/html" });
		res.end("<!doctype html><title>Attacker</title>");
	});
	const listening = Promise.withResolvers<void>();
	server.once("error", listening.reject);
	server.listen(0, listening.resolve);
	await listening.promise;
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("No attacker port");
	const attacker = `http://localhost:${address.port}`;
	try {
		// A fresh context prevents an existing per-tab session from affecting the result.
		const rootContext = await browser.newContext();
		try {
			const page = await rootContext.newPage();
			const requests: string[] = [];
			page.on("request", (req) => {
				const target = new URL(req.url());
				if (target.origin === url) requests.push(target.pathname);
			});
			await page.goto(attacker);
			const [root] = await Promise.all([
				page.waitForResponse(
					(response) =>
						response.url() === `${url}/` &&
						response.request().isNavigationRequest(),
				),
				page.evaluate((target) => {
					const link = document.createElement("a");
					link.href = `${target}/`;
					document.body.appendChild(link);
					link.click();
				}, url),
			]);
			expect(root.status()).toBe(200);
			expect((await root.request().allHeaders())["sec-fetch-site"]).toBe(
				"cross-site",
			);
			await expect(
				page.getByText("Open the local dashboard using han browse."),
			).toBeVisible();
			expect(
				await page.evaluate(() =>
					sessionStorage.getItem("han.dashboard.accessToken"),
				),
			).toBeNull();
			expect(requests).not.toContain("/_han/session");
			expect(requests).not.toContain("/graphql");

			// Same-origin metadata permits the request, but frame-ancestors blocks rendering.
			const framingError = page.waitForEvent("console", {
				predicate: (message) => message.text().includes("frame-ancestors"),
			});
			const frameResponse = page.waitForResponse(
				(response) =>
					response.url() === `${url}/` &&
					response.request().resourceType() === "document",
			);
			await page.evaluate(() => {
				const frame = document.createElement("iframe");
				frame.src = "/";
				document.body.appendChild(frame);
			});
			expect((await frameResponse).status()).toBe(200);
			await framingError;
		} finally {
			await rootContext.close();
		}

		const inventedContext = await browser.newContext();
		try {
			const page = await inventedContext.newPage();
			const paths: string[] = [];
			page.on("request", (req) => {
				const target = new URL(req.url());
				if (target.origin === url) paths.push(target.pathname);
			});
			await page.goto(attacker);
			const exchange = page.waitForResponse(
				(response) => response.url() === `${url}/_han/session`,
			);
			await page.evaluate((target) => {
				const link = document.createElement("a");
				link.href = `${target}/#launchToken=invalid`;
				document.body.appendChild(link);
				link.click();
			}, url);
			expect((await exchange).status()).toBe(401);
			await expect(
				page.getByText(
					"Dashboard launch expired or was rejected. Run han browse again.",
				),
			).toBeVisible();
			expect(
				await page.evaluate(() =>
					sessionStorage.getItem("han.dashboard.accessToken"),
				),
			).toBeNull();
			expect(paths).not.toContain("/graphql");
		} finally {
			await inventedContext.close();
		}

		const context = await browser.newContext();
		try {
			const page = await context.newPage();
			await page.goto(attacker);
			for (const tag of ["iframe", "img"] as const) {
				const response = page.waitForResponse(
					(res) =>
						res.url() === `${url}/` &&
						res.request().resourceType() ===
							(tag === "iframe" ? "document" : "image"),
				);
				await page.evaluate(
					({ target, tag }) => {
						const element = document.createElement(tag);
						element.src = `${target}/`;
						document.body.appendChild(element);
					},
					{ target: url, tag },
				);
				const result = await response;
				expect(result.status()).toBe(403);
				expect((await result.request().allHeaders())["sec-fetch-site"]).toBe(
					"cross-site",
				);
			}
			// Browser network policies may block either operation before it reaches the gateway.
			const browserResults = await page.evaluate(async (target) => {
				const api = await fetch(`${target}/graphql`, {
					method: "POST",
					headers: {
						"content-type": "application/json",
						authorization: "Bearer invalid",
					},
					body: JSON.stringify({ query: "query { __typename }" }),
				}).then(
					(response) => response.ok,
					() => false,
				);
				const socket = await new Promise<boolean>((resolve) => {
					const ws = new WebSocket(
						`${target.replace("http:", "ws:")}/graphql`,
						"graphql-transport-ws",
					);
					ws.onopen = () => {
						ws.close();
						resolve(true);
					};
					ws.onerror = () => resolve(false);
					ws.onclose = () => resolve(false);
				});
				return { api, socket };
			}, url);
			expect(browserResults).toEqual({ api: false, socket: false });
			// Raw controls prove the gateway, not merely browser CORS or local-network policy, rejects them.
			expect(
				await rawStatus(url, "/graphql", "OPTIONS", {
					origin: attacker,
					"sec-fetch-site": "cross-site",
					"access-control-request-method": "POST",
					"access-control-request-headers": "authorization,content-type",
				}),
			).toBe(403);
			expect(
				await rawStatus(url, "/graphql", "GET", {
					origin: attacker,
					"sec-fetch-site": "cross-site",
					connection: "Upgrade",
					upgrade: "websocket",
					"sec-websocket-version": "13",
					"sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
					"sec-websocket-protocol": "graphql-transport-ws",
					authorization: `Bearer ${token}`,
				}),
			).toBe(403);
		} finally {
			await context.close();
		}
	} finally {
		const closed = Promise.withResolvers<void>();
		server.close((error) => (error ? closed.reject(error) : closed.resolve()));
		await closed.promise;
	}
}

function observe(page: Page) {
	const subscriptions = new Set<string>();
	const events: Array<{ field: string; sessionId: string }> = [];
	let acknowledged = false;
	let messageSocket: BrowserSocket | undefined;
	page.on("websocket", (socket: BrowserSocket) => {
		if (!socket.url().endsWith("/graphql")) return;
		socket.on("framesent", ({ payload }) => {
			try {
				const frame = JSON.parse(String(payload));
				if (frame.type === "subscribe") {
					const query = String(frame.payload?.query ?? "");
					if (query.includes("SessionsContentSubscription")) {
						subscriptions.add("sessions");
					}
					if (query.includes("SessionMessagesSubscription")) {
						subscriptions.add("messages");
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
					if (value?.sessionId) {
						events.push({ field, sessionId: value.sessionId });
						if (field === "sessionMessageAdded") messageSocket = socket;
					}
				}
			} catch {
				/* Ignore non-JSON frames. */
			}
		});
	});
	return {
		subscriptions,
		events,
		acknowledged: () => acknowledged,
		closed: () => messageSocket?.isClosed() ?? false,
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
	const responses: Array<{
		path: string;
		status: number;
		site?: string;
		mode?: string;
		dest?: string;
		origin?: string;
	}> = [];
	const pageErrors: string[] = [];
	page.on("response", async (response) => {
		try {
			const target = new URL(response.url());
			if (target.hostname === "127.0.0.1") {
				const headers = await response.request().allHeaders();
				responses.push({
					path: target.pathname,
					status: response.status(),
					site: headers["sec-fetch-site"],
					mode: headers["sec-fetch-mode"],
					dest: headers["sec-fetch-dest"],
					origin:
						headers.origin === "null"
							? "null"
							: headers.origin
								? "present"
								: "absent",
				});
			}
		} catch {
			/* Ignore non-URL responses. */
		}
	});
	page.on("pageerror", (error) => {
		pageErrors.push(error.message.replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]"));
	});
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
		const [documentResponse, exchangeResponse, graph] = await Promise.all([
			page.waitForResponse(
				(response) =>
					response.url() === `${url}/` &&
					response.request().isNavigationRequest() &&
					response.request().frame() === page.mainFrame(),
				{ timeout: 45_000 },
			),
			page.waitForResponse(
				(response) =>
					response.url() === `${url}/_han/session` && response.status() === 200,
				{ timeout: 45_000 },
			),
			page.waitForResponse(
				(response) =>
					response.url() === `${url}/graphql` &&
					response.request().method() === "POST" &&
					response.status() === 200,
				{ timeout: 45_000 },
			),
			page.goto(launcher, { waitUntil: "domcontentloaded", timeout: 45_000 }),
		]).catch(() => {
			throw new Error(
				`Browser bootstrap failed; responses=${JSON.stringify(responses)}; pageErrors=${JSON.stringify(pageErrors)}`,
			);
		});
		const documentRequest = documentResponse.request();
		const documentUrl = new URL(documentRequest.url());
		expect(`${documentUrl.pathname}${documentUrl.search}`).toBe("/");
		expect(documentRequest.method()).toBe("GET");
		const documentHeaders = await documentRequest.allHeaders();
		expect(documentHeaders["sec-fetch-site"]).toBe("cross-site");
		expect(documentHeaders["sec-fetch-mode"]).toBe("navigate");
		expect(documentHeaders["sec-fetch-dest"]).toBe("document");
		expect(documentHeaders.origin).toBeUndefined();
		expect(documentResponse.status()).toBe(200);
		const securityHeaders = await documentResponse.allHeaders();
		expect(securityHeaders["referrer-policy"]).toBe("no-referrer");
		expect(securityHeaders["x-content-type-options"]).toBe("nosniff");
		expect(securityHeaders["content-security-policy"]).toContain(
			"frame-ancestors 'none'",
		);
		expect(exchangeResponse.status()).toBe(200);
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
		if (!token) throw new Error("Dashboard access token missing");
		await attackerControls(browser, url, token);
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
		await page.getByRole("button", { name: /^Messages(?: \(\d+\))?$/ }).click();
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
			await brokenPage
				.getByRole("button", { name: /^Messages(?: \(\d+\))?$/ })
				.click();
			await expect(
				brokenPage.getByText(message, { exact: false }),
			).toBeVisible();
			const priorEvents = observed.events.filter(
				(event) =>
					event.field === "sessionMessageAdded" && event.sessionId === id,
			).length;
			const withheld = `transport withheld ${randomUUID()}`;
			await appendFile(transcript, line(id, withheld));
			try {
				await until(
					() =>
						observed.events.filter(
							(event) =>
								event.field === "sessionMessageAdded" && event.sessionId === id,
						).length > priorEvents,
					"negative-control message delivered to the connected browser",
				);
			} catch (error) {
				const indexed = [
					...coordinatorOutput.matchAll(/Indexed (\d+) messages for session/g),
				].map((match) => Number(match[1]));
				throw new Error(
					`Live update stalled: priorEvents=${priorEvents}, connectedSocketClosed=${observed.closed()}, coordinatorExit=${coordinator.exitCode}, indexed=${JSON.stringify(indexed)}, indexErrors=${(coordinatorOutput.match(/Error handling file event/g) ?? []).length}`,
					{ cause: error },
				);
			}
			await expect(page.getByText(withheld, { exact: false })).toBeVisible();
			await sleep(3_000);
			await expect(
				brokenPage.getByText(withheld, { exact: false }),
			).not.toBeVisible();
		} finally {
			await broken.close();
		}

		expect(observed.closed()).toBe(false);
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
