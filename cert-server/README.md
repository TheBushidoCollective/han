# Certificate Distribution Server

Manages and distributes Let's Encrypt certificates for `coordinator.local.han.guru`.

## Setup

### 1. Google Cloud DNS Configuration

Create a service account with DNS Administrator permissions:

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

### 2. Railway Deployment

1. Create new Railway project
2. Add environment variable:

   ```
   GOOGLE_APPLICATION_CREDENTIALS_JSON=<paste entire JSON key file>
   ```

3. Deploy with Dockerfile
4. Get the Railway deployment URL (e.g., `certs-han.up.railway.app`)

### 3. DNS Configuration

Add CNAME record in Google Cloud DNS:

```
certs.han.guru CNAME certs-han.up.railway.app
```

### 4. Request Initial Certificate

SSH into Railway deployment or use the dashboard's shell:

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

After initial certificate is issued, restart the server to start serving certificates.

## API Endpoints

### GET /coordinator/latest

Returns the latest certificate for `coordinator.local.han.guru`:

```json
{
  "cert": "-----BEGIN CERTIFICATE-----\n...",
  "key": "-----BEGIN PRIVATE KEY-----\n...",
  "expires": "2026-04-22T00:00:00Z",
  "domain": "coordinator.local.han.guru"
}
```

### GET /health

Health check endpoint:

```json
{
  "status": "ok"
}
```

## Certificate Renewal

Certificates are automatically renewed via cron (runs daily). Certbot only renews when < 30 days until expiry.

## Security Note

The private key is "public" but the domain resolves to `127.0.0.1`, so connections stay local.
This follows the Plex pattern (`*.plex.direct`) for local HTTPS.
