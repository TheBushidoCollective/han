#!/bin/bash
# Certificate renewal script
# Runs daily via cron to renew certificates when needed

set -e

# Check if credentials file exists
if [ ! -f /app/gcloud-credentials.json ]; then
    echo "Error: Google Cloud credentials not found at /app/gcloud-credentials.json"
    exit 1
fi

# Renew certificates (certbot will only renew if < 30 days until expiry)
certbot renew --quiet \
    --dns-google \
    --dns-google-credentials /app/gcloud-credentials.json \
    --dns-google-propagation-seconds 60

echo "Certificate renewal check completed at $(date)"
