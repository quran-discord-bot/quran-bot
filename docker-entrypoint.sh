#!/bin/sh
set -e

# Set OpenSSL configuration for Prisma
export OPENSSL_CONF=/etc/ssl/openssl.cnf

# Detect architecture and set appropriate Prisma binary
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  export PRISMA_QUERY_ENGINE_BINARY=/app/node_modules/prisma/libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node
else
  export PRISMA_QUERY_ENGINE_BINARY=/app/node_modules/prisma/query-engine-linux-musl
fi

# Initialize database if needed
echo "🔄 Checking database on $ARCH architecture..."
if [ ! -f "db/prod.db" ]; then
  echo "📦 Database not found, creating database and applying schema..."
  npx prisma db push --force-reset || {
    echo "❌ Schema push failed, trying alternative approach..."
    npx prisma migrate reset --force || echo "⚠️ Migration reset failed"
  }
else
  echo "✅ Database exists, ensuring schema is current..."
  npx prisma db push || {
    echo "⚠️ Schema push failed, trying migrations..."
    npx prisma migrate deploy || echo "⚠️ Migration failed, continuing..."
  }
fi

# Start the Discord bot
echo "🤖 Starting Discord Bot on $ARCH..."
exec node index.js
