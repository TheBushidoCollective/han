/**
 * Certificate Distribution Server
 *
 * Serves Let's Encrypt certificates for coordinator.local.han.guru.
 * Certificates are renewed automatically via certbot with Google Cloud DNS.
 */

import { readFileSync } from 'node:fs';

const CERT_FILE =
  '/etc/letsencrypt/live/coordinator.local.han.guru/fullchain.pem';
const KEY_FILE = '/etc/letsencrypt/live/coordinator.local.han.guru/privkey.pem';
const PORT = Number(process.env.PORT) || 3000;

Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }

    // Certificate endpoint
    if (url.pathname === '/coordinator/latest') {
      try {
        const cert = readFileSync(CERT_FILE, 'utf-8');
        const key = readFileSync(KEY_FILE, 'utf-8');

        // Parse expiry from certificate (simplified - assumes 90 day validity)
        const expires = new Date(
          Date.now() + 90 * 24 * 60 * 60 * 1000
        ).toISOString();

        return Response.json({
          cert,
          key,
          expires,
          domain: 'coordinator.local.han.guru',
        });
      } catch (error) {
        console.error('Failed to read certificates:', error);
        return Response.json(
          { error: 'Certificate not found' },
          { status: 404 }
        );
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});

console.log(`Certificate server running on port ${PORT}`);
