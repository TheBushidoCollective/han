import { existsSync, readFileSync } from 'node:fs';

const logPath = process.argv[2];
console.log(`==> Auditing strace syscalls in: ${logPath}`);

if (!logPath || !existsSync(logPath)) {
  console.error('Log file not found');
  process.exit(1);
}

const content = readFileSync(logPath, 'utf8');
for (const line of content.split('\n')) {
  if (
    line.includes('kill(') ||
    line.includes('tkill(') ||
    line.includes('tgkill(')
  ) {
    if (line.includes('kill(0,') || line.includes('kill(-')) {
      console.error(`FORBIDDEN SYSCALL: ${line}`);
      process.exit(1);
    }
  }
}

console.log('PROOF PASS: syscall-audit');
process.exit(0);
