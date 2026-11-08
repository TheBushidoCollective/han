import { createServer } from 'node:net';

const variant = process.argv[2] || 'default';
console.log(`==> Running impostor coordinator variant: ${variant}`);

const server = createServer();
server.listen(41957, variant === 'loopback' ? '127.0.0.1' : '0.0.0.0');

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
