/**
 * Retired certificate distribution endpoint.
 * Local coordinators now generate an instance-specific identity.
 */
export function handleRequest(req: Request): Response {
  const url = new URL(req.url);

  // Health check endpoint
  if (url.pathname === '/health') {
    return Response.json({ status: 'ok' });
  }

  if (url.pathname === '/coordinator/latest') {
    return Response.json(
      {
        error: 'UPGRADE_REQUIRED',
        message:
          'Certificate distribution has retired. Upgrade Han and restart the coordinator.',
      },
      { status: 410, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

if (import.meta.main) {
  const port = Number(process.env.PORT) || 3000;
  Bun.serve({ port, fetch: handleRequest });
  console.log(`Certificate server running on port ${port}`);
}
