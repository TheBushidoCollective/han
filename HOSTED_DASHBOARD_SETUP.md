# Hosted Dashboard Implementation Guide

This document explains the hosted dashboard implementation and the infrastructure setup steps required to deploy it.

## What Was Implemented

### Code Changes

1. **Coordinator HTTPS Support** (`packages/han/lib/commands/coordinator/`)
   - `tls.ts`: Certificate fetching and caching logic
   - `server.ts`: Modified to support both HTTP and HTTPS modes
   - Automatically fetches Let's Encrypt certificates from distribution server
   - Gracefully falls back to HTTP if certificates unavailable

2. **Frontend URL Resolution** (`packages/browse-client/src/`)
   - `config/urls.ts`: Runtime URL detection for hosted vs local mode
   - `relay/environment.ts`: Updated to use dynamic URL configuration
   - Detects hosted mode by checking `window.location.hostname`

3. **Railway Deployment Files**
   - `packages/browse-client/serve.ts`: Static file server for dashboard
   - `packages/browse-client/Dockerfile`: Container config for dashboard
   - `cert-server/`: Complete certificate distribution server

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│         https://dashboard.local.han.guru (Railway)              │
│         Static React/Relay frontend                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + WebSocket
                              │ (valid Let's Encrypt cert)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│      https://coordinator.local.han.guru:41957                   │
│      DNS A record → 127.0.0.1                                   │
│      Valid Let's Encrypt certificate (fetched from server)     │
│      Actually connects to localhost!                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     Local coordinator daemon
```

## Infrastructure Setup Required

### Prerequisites

- Google Cloud account with Cloud DNS
- Railway account for deployments
- Domain `local.han.guru` managed in Google Cloud DNS

### Step 1: Google Cloud DNS Configuration

1. **Create DNS records** in Google Cloud DNS for `local.han.guru` zone:

   ```
   # A record - points to localhost
   coordinator.local.han.guru  A  127.0.0.1

   # TXT record for Let's Encrypt DNS-01 challenge (added automatically by certbot)
   _acme-challenge.coordinator.local.han.guru  TXT  (managed by certbot)
   ```

2. **Create service account** for Let's Encrypt:

   ```bash
   # Create service account
   gcloud iam service-accounts create han-certbot \
       --display-name="Han Certbot DNS" \
       --project=YOUR_PROJECT_ID

   # Grant DNS Administrator role
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
       --member="serviceAccount:han-certbot@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
       --role="roles/dns.admin"

   # Create and download key
   gcloud iam service-accounts keys create gcloud-credentials.json \
       --iam-account=han-certbot@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

### Step 2: Deploy Certificate Server to Railway

1. **Create new Railway project** named "han-cert-server"

2. **Add environment variable**:

   ```
   GOOGLE_APPLICATION_CREDENTIALS_JSON=<paste entire JSON from gcloud-credentials.json>
   ```

3. **Deploy from directory**: `cert-server/`
   - Railway will use the Dockerfile automatically
   - Get deployment URL (e.g., `certs-han.up.railway.app`)

4. **Add DNS CNAME** for cert server:

   ```
   certs.han.guru  CNAME  certs-han.up.railway.app
   ```

5. **Request initial certificate** via Railway shell:

   ```bash
   certbot certonly \
     --dns-google \
     --dns-google-credentials /app/gcloud-credentials.json \
     --dns-google-propagation-seconds 60 \
     -d coordinator.local.han.guru \
     --non-interactive \
     --agree-tos \
     -m your-email@example.com
   ```

6. **Restart the Railway service** to start serving certificates

7. **Verify certificate endpoint**:

   ```bash
   curl https://certs.han.guru/coordinator/latest | jq
   ```

### Step 3: Deploy Dashboard to Railway

1. **Create new Railway project** named "han-dashboard"

2. **Deploy from directory**: `packages/browse-client/`
   - Railway will use the Dockerfile
   - Get deployment URL (e.g., `dashboard-han.up.railway.app`)

3. **Add DNS CNAME** for dashboard:

   ```
   dashboard.local.han.guru  CNAME  dashboard-han.up.railway.app
   ```

4. **Verify dashboard loads**:
   - Visit `https://dashboard.local.han.guru`
   - Should show "Han Dashboard" UI (may show placeholder if coordinator not running)

## Local Testing

### Test Certificate Fetching

```bash
# Start coordinator - it should fetch certificates automatically
cd packages/han
bun lib/main.ts coordinator start

# Check logs for:
# "Fetching certificates from https://certs.han.guru/coordinator/latest..."
# "HTTPS enabled with Let's Encrypt certificate"

# Verify cached certificates
ls -la ~/.claude/han/certs/
cat ~/.claude/han/certs/metadata.json
```

### Test HTTPS Coordinator

```bash
# Test GraphQL over HTTPS
curl https://coordinator.local.han.guru:41957/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Should return: {"data":{"__typename":"Query"}}
```

### Test Hosted Dashboard

1. **Start local coordinator**:

   ```bash
   han coordinator start
   ```

2. **Open dashboard** in browser:

   ```
   https://dashboard.local.han.guru
   ```

3. **Verify in DevTools**:
   - Network tab shows requests to `https://coordinator.local.han.guru:41957`
   - WebSocket connection at `wss://coordinator.local.han.guru:41957/graphql`
   - No certificate warnings
   - No CORS errors
   - Sessions and messages load correctly

### Test Local Development Mode

```bash
# Traditional local development still works
han browse

# Should open http://localhost:41956
# Connects to http://127.0.0.1:41900/graphql
```

## Certificate Renewal

Certificates auto-renew via cron in the cert-server Railway deployment:

- Runs daily
- Only renews when < 30 days until expiry
- No manual intervention required

## Rollback Plan

If issues occur:

1. Remove `dashboard.local.han.guru` CNAME
2. Coordinator falls back to HTTP automatically
3. Users continue with `han browse` command
4. No data loss - everything is local

## Security Model

This implementation follows the "Plex pattern":

- Private key is technically "public" (available via API)
- BUT domain resolves to `127.0.0.1`
- Connection stays entirely local
- Cannot MITM yourself
- Browser accepts certificate because it's valid for the domain

## Implementation Status

✅ Coordinator HTTPS/TLS support
✅ Frontend URL resolution
✅ CORS configuration
✅ Railway deployment files
✅ Certificate server implementation
✅ TypeScript compilation verified

## Next Steps

1. Deploy cert-server to Railway
2. Request initial Let's Encrypt certificate
3. Deploy dashboard to Railway
4. Configure DNS records
5. Test end-to-end flow
6. Announce to users
