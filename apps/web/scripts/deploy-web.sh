#!/bin/sh
# Build the web app for production and publish it to the live site.
#
# The prod `todly-web` container (docker-compose.prod.yml) serves
# apps/web/dist straight from the host, so deploying is just a rebuild —
# nginx picks up the new files immediately, no container restart.
#
# Usage:  cd apps/web && ./scripts/deploy-web.sh
set -e

cd "$(dirname "$0")/.."

echo "▸ building web (base=/todly/) ..."
VITE_BASE_PATH=/todly/ \
VITE_API_BASE_URL=/todly/api/v1 \
VITE_WS_URL=/todly/ws \
  npm run build

echo "▸ done — https://mohe.today/todly now serves apps/web/dist"
echo "  (the native app wraps that URL, so it updates on next open/refresh)"
