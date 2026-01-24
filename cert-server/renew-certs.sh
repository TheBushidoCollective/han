#!/bin/bash
# Certificate renewal script
# Runs every 12 hours via cron to renew 6-day certificates when needed

set -e

# Check if credentials file exists
if [ ! -f /app/gcloud-credentials.json ]; then
    echo "Error: Google Cloud credentials not found at /app/gcloud-credentials.json"
    exit 1
fi

# Renew certificates
# For 6-day certs (160 hours), renew when < 48 hours (2 days) remaining
# Note: certbot's default threshold is 30 days, we override with --renew-within-days 2
certbot renew --quiet \
    --dns-google \
    --dns-google-credentials /app/gcloud-credentials.json \
    --dns-google-propagation-seconds 60 \
    --renew-within-days 2

echo "Certificate renewal check completed at $(date)"
