#!/bin/bash
set -e

# Run migrations if AUTO_MIGRATE is enabled
if [ "${AUTO_MIGRATE:-false}" = "true" ]; then
  echo "Running database migrations..."
  bun run migrate
  echo "Migrations complete."
fi

# Execute the main command
exec "$@"
