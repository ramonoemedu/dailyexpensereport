#!/bin/sh
set -e

echo "Running database migrations..."
npx --yes prisma@6 migrate deploy

echo "Starting application..."
exec node server.js
