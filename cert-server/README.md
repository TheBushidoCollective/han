# Certificate Distribution Server

Manages and distributes Let's Encrypt **6-day short-lived certificates** for `coordinator.local.han.guru`.

Uses Let's Encrypt's new short-lived certificate profile (160 hours / ~6 days validity) for improved security through frequent rotation.

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

### 4. Request Initial 6-Day Certificate

SSH into Railway deployment or use the dashboard's shell:

```bash
certbot certonly \
  --dns-google \
  --dns-google-credentials /app/gcloud-credentials.json \
  --dns-google-propagation-seconds 60 \
  -d coordinator.local.han.guru \
  --preferred-chain shortlived \
  --non-interactive \
  --agree-tos \
  -m your-email@example.com
```

The `--preferred-chain shortlived` flag requests a 6-day (160 hour) certificate instead of the standard 90-day certificate.

After initial certificate is issued, restart the server to start serving certificates.

## API Endpoints

### GET /coordinator/latest

Returns the latest certificate for `coordinator.local.han.guru`:

```json
{
  "cert": "-----BEGIN CERTIFICATE-----\n...",
  "key": "-----BEGIN PRIVATE KEY-----\n...",
  "expires": "2026-01-29T18:00:00Z",
  "domain": "coordinator.local.han.guru"
}
```

Note: 6-day certificates expire ~160 hours after issuance.

### GET /health

Health check endpoint:

```json
{
  "status": "ok"
}
```

## Certificate Renewal

Certificates are automatically renewed via cron (runs **every 12 hours**).

For 6-day certificates (160 hours validity):
- Renewal triggers when < 48 hours (2 days) remaining
- Cron runs at 00:00 and 12:00 UTC daily
- More frequent checks ensure certificates never expire

Standard 90-day certificates renew at < 30 days, but short-lived certs require much tighter rotation.

## Security Notes

### Public Private Key Pattern
The private key is "public" (distributed to all han users) but the domain resolves to `127.0.0.1`, so connections stay local.
This follows the Plex pattern (`*.plex.direct`) for local HTTPS.

### Why 6-Day Certificates?
Short-lived certificates (160 hours) provide:
- **Reduced vulnerability window**: Even if a key is compromised, it's only valid for 6 days
- **Forced automation**: Ensures our renewal system is battle-tested and reliable
- **Preparation for future**: Let's Encrypt's direction is toward shorter certificate lifetimes
- **Better for public keys**: Since our private key is distributed publicly, shorter validity reduces risk

The rapid rotation (every ~4 days) ensures that even with public key distribution, the security posture remains strong.
