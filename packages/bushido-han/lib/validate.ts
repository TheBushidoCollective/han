import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface ValidateOptions {
  failFast: boolean;
  dirsWith: string | null;
  command: string;
}

// Find directories
function findDirectories(rootDir: string): string[] {
  const dirs: string[] = [];

  // Try to use git to find tracked directories
  try {
    const gitDirs = execSync('git ls-files', {
      cwd: rootDir,
      encoding: 'utf8',
    })
      .split('\n')
      .map((file) => {
        const parts = file.split('/');
        return parts.length > 1 ? parts[0] : null;
      })
      .filter((dir): dir is string => dir !== null);

    const uniqueDirs = [...new Set(gitDirs)];
    uniqueDirs.forEach((dir) => {
      const fullPath = join(rootDir, dir);
      if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
        dirs.push(fullPath);
      }
    });
  } catch (_e) {
    // Git not available or not in git repo, use glob
    const entries = readdirSync(rootDir, { withFileTypes: true });
    entries.forEach((entry) => {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        dirs.push(join(rootDir, entry.name));
      }
    });
  }

  return dirs;
}

// Filter directories by marker file
function filterDirectories(
  dirs: string[],
  markerFile: string | null
): string[] {
  if (!markerFile) return dirs;

  return dirs.filter((dir) => {
    return existsSync(join(dir, markerFile));
  });
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
  const rootDir = process.cwd();
  const allDirs = findDirectories(rootDir);
  const targetDirs = filterDirectories(allDirs, dirsWith);

  if (targetDirs.length === 0) {
    if (dirsWith) {
      console.log(`No directories found with ${dirsWith}`);
      process.exit(0);
    } else {
      console.error('No directories found');
      process.exit(1);
    }
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
