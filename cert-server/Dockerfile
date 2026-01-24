# Certificate Distribution Server
# Manages Let's Encrypt certificates and serves them via HTTP API

FROM debian:bookworm-slim

# Install Bun
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install certbot with Google Cloud DNS plugin
RUN apt-get update && apt-get install -y \
    certbot \
    python3-certbot-dns-google \
    cron \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./
RUN bun install

# Copy application files
COPY server.ts ./
COPY renew-certs.sh /app/renew-certs.sh
RUN chmod +x /app/renew-certs.sh

# Set up cron job to run every 12 hours (at 00:00 and 12:00)
# For 6-day certificates, more frequent renewal checks are critical
RUN echo "0 */12 * * * /app/renew-certs.sh >> /var/log/cert-renewal.log 2>&1" > /etc/cron.d/renew-certs \
    && chmod 0644 /etc/cron.d/renew-certs \
    && crontab /etc/cron.d/renew-certs

# Copy entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

CMD ["./entrypoint.sh"]
