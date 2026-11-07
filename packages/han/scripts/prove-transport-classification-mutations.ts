import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.CI !== 'true') {
  throw new Error('Transport mutation proof requires an isolated CI checkout');
}

const connectionPath = join(
  import.meta.dir,
  '../lib/coordinator/connection.ts'
);
const errorsPath = join(import.meta.dir, '../lib/coordinator/errors.ts');
const name = process.argv[2];

const mutations: Record<
  string,
  {
    file: string;
    anchor: string;
    replacement: string;
    expectedFailure: string;
    env?: Record<string, string>;
  }
> = {
  untypedRefusal: {
    file: connectionPath,
    anchor:
      'throw new CoordinatorConnectionRefusedError(\n        `Coordinator connection failed: ${error.message}`,\n        { cause: error }\n      );',
    replacement:
      'throw new CoordinatorSecurityError(\n        `Coordinator connection failed: ${error.message}`,\n        { cause: error }\n      );',
    expectedFailure: 'refused-https: not CoordinatorConnectionRefusedError',
  },
  refusalNotSecurity: {
    file: errorsPath,
    anchor:
      'export class CoordinatorConnectionRefusedError extends CoordinatorSecurityError {',
    replacement:
      'export class CoordinatorConnectionRefusedError extends Error {',
    expectedFailure: 'refused-https: not CoordinatorSecurityError',
  },
  anyCodeAsRefusal: {
    file: connectionPath,
    anchor: "(error as { code?: unknown }).code === 'ECONNREFUSED'",
    replacement: 'true',
    expectedFailure: 'pin-mismatch-https: typed',
  },
  securityAsRefusal: {
    file: connectionPath,
    anchor:
      'error instanceof CoordinatorConnectionRefusedError ||\n    (error instanceof ConnectError &&\n      error.cause instanceof CoordinatorConnectionRefusedError)',
    replacement: 'error instanceof CoordinatorSecurityError',
    expectedFailure: 'pin-mismatch-https: classifier true',
  },
  causeIgnored: {
    file: connectionPath,
    anchor:
      '(error instanceof ConnectError &&\n      error.cause instanceof CoordinatorConnectionRefusedError)',
    replacement: 'false',
    expectedFailure: 'refused-grpc: classifier false',
  },
  proxyInherited: {
    file: connectionPath,
    anchor: 'proxy: false as unknown as undefined,',
    replacement: '',
    expectedFailure: 'FAIL proxy-env-direct',
    env: { HTTPS_PROXY: 'http://127.0.0.1:9' },
  },
};

const mutation = mutations[name];
if (!mutation) throw new Error(`Unknown transport mutation: ${name}`);

const targetFile = mutation.file;
const original = readFileSync(targetFile, 'utf8');

if (!original.includes(mutation.anchor)) {
  throw new Error(`Mutation anchor not found in source: ${name}`);
}
if (original.split(mutation.anchor).length !== 2) {
  throw new Error(`Mutation anchor not unique in source: ${name}`);
}

const modified = original.replace(mutation.anchor, mutation.replacement);
if (modified === original) {
  throw new Error(`Mutation did not modify source: ${name}`);
}

function restoreSource(): void {
  writeFileSync(targetFile, original);
  if (readFileSync(targetFile, 'utf8') !== original) {
    console.error(`Failed to restore ${targetFile} source`);
    process.exitCode = 1;
  }
}

try {
  writeFileSync(targetFile, modified);
  const result = Bun.spawnSync(
    [process.execPath, 'run', 'scripts/prove-transport-classification.ts'],
    {
      cwd: join(import.meta.dir, '..'),
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        ...(mutation.env ?? {}),
      },
    }
  );
  const output = result.stdout.toString() + result.stderr.toString();
  console.log(output);

  if (result.exitCode === 0) {
    throw new Error(`Mutation ${name} unexpectedly succeeded`);
  }
  if (!output.includes(mutation.expectedFailure)) {
    throw new Error(
      `Mutation ${name} failed without expected marker: ${mutation.expectedFailure}`
    );
  }
  console.log(
    `Mutation ${name} correctly failed with: ${mutation.expectedFailure}`
  );
} finally {
  restoreSource();
}
