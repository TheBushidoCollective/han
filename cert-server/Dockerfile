# Retirement response for the former certificate distribution endpoint.

FROM debian:bookworm-slim

# Install Bun
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

# Copy package files
COPY package.json ./
RUN bun install

# Copy the retirement response.
COPY server.ts ./

# Copy entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

CMD ["./entrypoint.sh"]
