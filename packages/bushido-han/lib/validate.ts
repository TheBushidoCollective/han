import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

interface ValidateOptions {
  failFast: boolean;
  dirsWith: string | null;
  command: string;
}

// Recursively find all directories containing a marker file
function findDirectoriesWithMarker(
  rootDir: string,
  markerFile: string
): string[] {
  const dirs: string[] = [];

  function searchDir(dir: string): void {
    // Skip hidden directories and node_modules
    const basename = dir.split('/').pop() || '';
    if (basename.startsWith('.') || basename === 'node_modules') {
      return;
    }

    try {
      // Check if this directory contains the marker file
      if (existsSync(join(dir, markerFile))) {
        dirs.push(dir);
      }

      // Recursively search subdirectories
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          searchDir(join(dir, entry.name));
        }
      }
    } catch (_e) {
      // Skip directories we can't read
    }
  }

  searchDir(rootDir);
  return dirs;
}

// Run command in directory
function runCommand(dir: string, cmd: string): boolean {
  try {
    execSync(cmd, {
      cwd: dir,
      stdio: 'inherit',
      encoding: 'utf8',
    });
    return true;
  } catch (_e) {
    return false;
  }
}

export function validate(options: ValidateOptions): void {
  const { failFast, dirsWith, command: commandToRun } = options;

  // Main execution
  const rootDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  if (!dirsWith) {
    console.error('Error: --dirs-with <file> is required');
    process.exit(1);
  }

  const targetDirs = findDirectoriesWithMarker(rootDir, dirsWith);

  if (targetDirs.length === 0) {
    console.log(`No directories found with ${dirsWith}`);
    process.exit(0);
  }

  const failures: string[] = [];

  for (const dir of targetDirs) {
    const success = runCommand(dir, commandToRun);

    if (!success) {
      const relativePath = dir.replace(`${rootDir}/`, '');
      failures.push(relativePath);

      console.error(
        `\nFailed when trying to run \`${commandToRun}\` in directory: \`${relativePath}\`\n`
      );

      if (failFast) {
        process.exit(2);
      }
    }
  }

  if (failures.length > 0) {
    console.error(
      `\n❌ ${failures.length} director${failures.length === 1 ? 'y' : 'ies'} failed validation:\n`
    );
    for (const dir of failures) {
      console.error(`  - ${dir}`);
    }
    process.exit(2);
  }

  console.log(
    `\n✅ All ${targetDirs.length} director${targetDirs.length === 1 ? 'y' : 'ies'} passed validation`
  );
  process.exit(0);
}
