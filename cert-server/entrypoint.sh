#!/bin/bash
# Entrypoint script for certificate server
# Sets up Google Cloud credentials and starts services

set -e

echo "Setting up certificate server..."

# Create credentials file from environment variable
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS_JSON" ]; then
    echo "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /app/gcloud-credentials.json
    chmod 600 /app/gcloud-credentials.json
    echo "Google Cloud credentials configured"
else
    echo "Warning: GOOGLE_APPLICATION_CREDENTIALS_JSON not set"
fi

# Check if certificates already exist
if [ ! -d "/etc/letsencrypt/live/coordinator.local.han.guru" ]; then
    echo "No certificates found. You need to request initial 6-day certificates manually."
    echo ""
    echo "Run:"
    echo "certbot certonly \\"
    echo "  --dns-google \\"
    echo "  --dns-google-credentials /app/gcloud-credentials.json \\"
    echo "  --dns-google-propagation-seconds 60 \\"
    echo "  -d coordinator.local.han.guru \\"
    echo "  --preferred-chain shortlived \\"
    echo "  --non-interactive \\"
    echo "  --agree-tos \\"
    echo "  -m your-email@example.com"
    echo ""
    echo "Starting server in degraded mode (health checks only)..."
else
    echo "Certificates found at /etc/letsencrypt/live/coordinator.local.han.guru"
fi

# Start cron daemon for automatic renewals
cron
echo "Cron daemon started for certificate renewal"

# Start the certificate server
echo "Starting certificate server on port ${PORT:-3000}..."
exec bun server.ts
