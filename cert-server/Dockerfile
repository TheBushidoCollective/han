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
COPY renew-certs.sh /etc/cron.daily/renew-certs
RUN chmod +x /etc/cron.daily/renew-certs

# Copy entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

CMD ["./entrypoint.sh"]
