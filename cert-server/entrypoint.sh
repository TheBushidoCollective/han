#!/bin/bash
# The service remains available only to return the retirement response.
set -e
exec bun server.ts
