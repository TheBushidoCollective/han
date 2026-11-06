import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDevMode } from '../../shared.ts';
import {
  ensureCoordinator,
  getBrowsePort,
  getCoordinatorPort,
} from '../coordinator/index.ts';
import { startHostedDashboardProxy } from './hosted-proxy.ts';
import type { BrowseOptions } from './types.ts';

const clientDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'browse-client'
);

export async function openBrowser(url: string): Promise<boolean> {
  const plat = platform();
  const cmd =
    plat === 'darwin' ? 'open' : plat === 'win32' ? 'cmd' : 'xdg-open';
  const args = plat === 'win32' ? ['/c', 'start', '', url] : [url];
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
  child.once('error', () => resolve(false));
  child.once('spawn', () => {
    child.unref();
    resolve(true);
  });
  return promise;
}

async function runBuild(): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const child = spawn('bun', ['run', 'build'], {
    cwd: clientDir,
    stdio: 'inherit',
    env: { ...process.env, HAN_BUILD_TARGET: 'local-dashboard' },
  });
  child.once('error', reject);
  child.once('exit', (code) =>
    code === 0
      ? resolve()
      : reject(new Error(`Dashboard build failed (${code})`))
  );
  await promise;
}

async function freePort(): Promise<number> {
  const socket = createServer();
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  socket.once('error', reject);
  socket.listen(0, '127.0.0.1', () => {
    const address = socket.address();
    if (!address || typeof address === 'string') {
      socket.close();
      reject(new Error('No loopback port'));
      return;
    }
    socket.close(() => resolve(address.port));
  });
  return promise;
}

async function waitForVite(origin: string, vite: ChildProcess): Promise<void> {
  let failure: Error | undefined;
  vite.once('error', (error) => {
    failure = error;
  });
  for (let i = 0; i < 150; i++) {
    if (failure) throw failure;
    if (vite.exitCode !== null || vite.signalCode !== null)
      throw new Error('Vite exited before becoming ready');
    try {
      const response = await fetch(`${origin}/han-dashboard-manifest.json`);
      if (response.ok) return;
    } catch {
      /* Starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Vite did not become ready');
}

export async function browse(options: BrowseOptions = {}): Promise<void> {
  let port = options.port ?? getBrowsePort();
  await ensureCoordinator(getCoordinatorPort());
  let vite: ChildProcess | undefined;
  let relay: ChildProcess | undefined;
  let origin: string | undefined;
  let assetDir: string | undefined;
  const dev = options.local === true && isDevMode();
  try {
    if (options.local) {
      if (!existsSync(clientDir))
        throw new Error(`browse-client not found at ${clientDir}`);
      if (dev) {
        if (port === 0) port = await freePort();
        const vitePort = await freePort();
        origin = `http://127.0.0.1:${vitePort}`;
        relay = spawn('npx', ['relay-compiler', '--watch'], {
          cwd: clientDir,
          stdio: 'inherit',
        });
        relay.on('error', (error) =>
          console.error('[relay] Failed to start:', error.message)
        );
        vite = spawn(
          'npx',
          [
            'vite',
            '--host',
            '127.0.0.1',
            '--port',
            String(vitePort),
            '--strictPort',
          ],
          {
            cwd: clientDir,
            stdio: 'inherit',
            env: { ...process.env, HAN_GATEWAY_PORT: String(port) },
          }
        );
        await waitForVite(origin, vite);
      } else {
        await runBuild();
        assetDir = join(clientDir, 'out');
      }
    }
    const gateway = await startHostedDashboardProxy({
      port,
      origin,
      assetDir,
      dev,
    });
    console.log(`[han] Dashboard gateway listening at ${gateway.url}`);
    console.log(`[han] Launcher: ${gateway.launcherUrl}`);
    if (options.open !== false && !(await openBrowser(gateway.launcherUrl)))
      console.error(
        '[han] Could not open the launcher. Open the file URL shown above.'
      );
    const stopped = Promise.withResolvers<void>();
    let closing = false;
    const shutdown = () => {
      if (!closing) {
        closing = true;
        void gateway.close().finally(stopped.resolve);
      }
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    if (vite) {
      vite.once('exit', shutdown);
      if (vite.exitCode !== null || vite.signalCode !== null) shutdown();
    }
    await stopped.promise;
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
  } finally {
    vite?.kill('SIGTERM');
    relay?.kill('SIGTERM');
  }
}
