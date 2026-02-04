/**
 * launchd Installation for Han Coordinator
 *
 * Provides macOS native daemon management with:
 * - Automatic restart on crash
 * - Start on login (optional)
 * - Proper log rotation
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PLIST_NAME = 'com.thebushidocollective.han-coordinator';
const LAUNCHD_DIR = join(homedir(), 'Library', 'LaunchAgents');
const PLIST_PATH = join(LAUNCHD_DIR, `${PLIST_NAME}.plist`);
const HAN_DIR = join(homedir(), '.claude', 'han');
const LOG_DIR = join(HAN_DIR, 'logs');

/**
 * Generate the launchd plist content
 */
function generatePlist(hanBinaryPath: string, port: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${hanBinaryPath}</string>
        <string>coordinator</string>
        <string>start</string>
        <string>--foreground</string>
        <string>--port</string>
        <string>${port}</string>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
        <key>HAN_COORDINATOR_DAEMON</key>
        <string>1</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>

    <key>ThrottleInterval</key>
    <integer>5</integer>

    <key>StandardOutPath</key>
    <string>${join(LOG_DIR, 'coordinator.stdout.log')}</string>

    <key>StandardErrorPath</key>
    <string>${join(LOG_DIR, 'coordinator.stderr.log')}</string>

    <key>WorkingDirectory</key>
    <string>${homedir()}</string>
</dict>
</plist>`;
}

/**
 * Find the han binary path
 */
function findHanBinary(): string {
  // Check common locations
  const locations = [
    join(homedir(), '.claude', 'bin', 'han'),
    '/usr/local/bin/han',
    '/opt/homebrew/bin/han',
    // Fallback: for compiled binaries, process.execPath is the binary itself
    // Note: process.argv[1] returns internal /$bunfs/... paths that don't exist on filesystem
    process.execPath,
  ];

  for (const loc of locations) {
    if (existsSync(loc)) {
      return loc;
    }
  }

  throw new Error(
    'Could not find han binary. Install with: curl -fsSL https://han.guru/install.sh | bash'
  );
}

/**
 * Install the launchd agent
 */
export async function installLaunchd(options: {
  port?: number;
  force?: boolean;
}): Promise<void> {
  const port = options.port ?? 41957;

  // Check if already installed
  if (existsSync(PLIST_PATH) && !options.force) {
    console.log('[launchd] Agent already installed. Use --force to reinstall.');
    return;
  }

  // Find han binary
  let hanBinary: string;
  try {
    hanBinary = findHanBinary();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  // Ensure directories exist
  if (!existsSync(LAUNCHD_DIR)) {
    mkdirSync(LAUNCHD_DIR, { recursive: true });
  }
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }

  // Unload existing if present
  if (existsSync(PLIST_PATH)) {
    try {
      execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, {
        stdio: 'ignore',
      });
    } catch {
      // Ignore errors
    }
  }

  // Write plist
  const plist = generatePlist(hanBinary, port);
  writeFileSync(PLIST_PATH, plist, 'utf-8');
  console.log(`[launchd] Created ${PLIST_PATH}`);

  // Load agent
  try {
    execSync(`launchctl load "${PLIST_PATH}"`, { stdio: 'inherit' });
    console.log('[launchd] Agent loaded successfully');
  } catch {
    console.error('[launchd] Failed to load agent');
    process.exit(1);
  }

  console.log('\n[launchd] Han coordinator will now:');
  console.log('  - Start automatically on login');
  console.log('  - Restart automatically if it crashes');
  console.log(`  - Log to ${LOG_DIR}/`);
  console.log('\nCommands:');
  console.log('  han coordinator status    - Check status');
  console.log('  han coordinator stop      - Stop coordinator');
  console.log('  han launchd uninstall     - Remove launchd agent');
}

/**
 * Uninstall the launchd agent
 */
export async function uninstallLaunchd(): Promise<void> {
  if (!existsSync(PLIST_PATH)) {
    console.log('[launchd] Agent not installed');
    return;
  }

  // Unload agent
  try {
    execSync(`launchctl unload "${PLIST_PATH}"`, { stdio: 'ignore' });
  } catch {
    // Ignore errors
  }

  // Remove plist
  unlinkSync(PLIST_PATH);
  console.log('[launchd] Agent uninstalled');
}

/**
 * Get launchd agent status
 */
export async function getLaunchdStatus(): Promise<{
  installed: boolean;
  running: boolean;
  pid?: number;
}> {
  if (!existsSync(PLIST_PATH)) {
    return { installed: false, running: false };
  }

  try {
    const output = execSync(`launchctl list | grep "${PLIST_NAME}"`, {
      encoding: 'utf-8',
    });
    const match = output.match(/^(\d+|-)\s+/);
    const pid = match && match[1] !== '-' ? parseInt(match[1], 10) : undefined;
    return {
      installed: true,
      running: pid !== undefined,
      pid,
    };
  } catch {
    return { installed: true, running: false };
  }
}
