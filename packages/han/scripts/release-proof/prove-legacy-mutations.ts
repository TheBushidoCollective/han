import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = process.argv[2] || 'all';
console.log(`==> Running prove-legacy-mutations (${arg})...`);

const legacyTsPath = join(import.meta.dir, '../../lib/coordinator/legacy.ts');

const mutations: Record<
  string,
  {
    file: string;
    anchor: string;
    replacement: string;
    testCommand: string[];
    expectedErrorMarker: string;
  }
> = {
  validatorRelaxation: {
    file: legacyTsPath,
    anchor: "if (status === 'legacy') {",
    replacement: "if (status === 'legacy' || status === 'foreign') {",
    testCommand: ['bun', join(import.meta.dir, 'prove-legacy-negative.ts')],
    expectedErrorMarker: 'N0 FAIL',
  },
  untypedRefusal: {
    file: legacyTsPath,
    anchor: 'throw new CoordinatorPortOccupiedError(',
    replacement: 'throw new Error(',
    testCommand: ['bun', join(import.meta.dir, 'prove-legacy-negative.ts')],
    expectedErrorMarker: 'N1 FAIL',
  },
};

const mutationNames = arg === 'all' ? Object.keys(mutations) : [arg];

for (const name of mutationNames) {
  const mut = mutations[name];
  if (!mut) {
    throw new Error(`Unknown legacy mutation: ${name}`);
  }

  const original = readFileSync(mut.file, 'utf8');
  if (!original.includes(mut.anchor)) {
    throw new Error(`Mutation anchor not found in ${mut.file} for ${name}`);
  }

  const modified = original.replace(mut.anchor, mut.replacement);
  try {
    writeFileSync(mut.file, modified);
    const result = Bun.spawnSync(mut.testCommand, {
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    });
    const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
    if (result.exitCode === 0) {
      throw new Error(
        `Mutation ${name} unexpectedly passed (should have failed)`
      );
    }
    if (!output.includes(mut.expectedErrorMarker)) {
      throw new Error(
        `Mutation ${name} failed without expected marker ${mut.expectedErrorMarker}:\n${output}`
      );
    }
    console.log(
      `Mutation ${name} correctly rejected (exitCode ${result.exitCode})`
    );
  } finally {
    writeFileSync(mut.file, original);
  }
}

console.log('PROOF PASS: prove-legacy-mutations');
process.exit(0);
