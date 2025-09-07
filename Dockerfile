# =========================================================================================
# BUILDER STAGE: Install dependencies and compile native modules
# =========================================================================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy only package files to leverage Docker's layer caching
COPY package*.json ./

# Install ALL dependencies (including dev for Prisma) and build
# We need dev dependencies here for `prisma generate`
RUN npm install --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy source code and Prisma schema
COPY prisma ./prisma/
COPY . .

# Generate the Prisma client for the correct target (Alpine Linux)
# Ensure your schema.prisma has "linux-musl" in binaryTargets
RUN npx prisma generate

# =========================================================================================
# PRODUCTION STAGE: Create the final, small image
# =========================================================================================
FROM node:18-alpine AS production

WORKDIR /app

# Copy built node_modules and Prisma client from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated

# Copy application source code (adjust if you use a build step like TypeScript)
COPY assets ./assets
COPY commands ./commands
COPY events ./events
COPY prisma ./prisma
COPY db ./db
COPY utility ./utility
COPY index.js .
COPY package*.json ./

# Set environment variable for production
ENV NODE_ENV=production

# Create database initialization script with better error handling
RUN echo '#!/bin/sh' > docker-entrypoint.sh && \
    echo 'set -e' >> docker-entrypoint.sh && \
    echo '' >> docker-entrypoint.sh && \
    echo '# Set OpenSSL configuration for Prisma' >> docker-entrypoint.sh && \
    echo 'export OPENSSL_CONF=/etc/ssl/openssl.cnf' >> docker-entrypoint.sh && \
    echo 'export PRISMA_QUERY_ENGINE_BINARY=/app/node_modules/prisma/query-engine-linux-musl' >> docker-entrypoint.sh && \
    echo '' >> docker-entrypoint.sh && \
    echo '# Initialize database if needed' >> docker-entrypoint.sh && \
    echo 'echo "Checking database..."' >> docker-entrypoint.sh && \
    echo 'if [ ! -f "db/prod.db" ]; then' >> docker-entrypoint.sh && \
    echo '  echo "Database not found, creating database and applying schema..."' >> docker-entrypoint.sh && \
    echo '  npx prisma db push --force-reset || {' >> docker-entrypoint.sh && \
    echo '    echo "Schema push failed, trying alternative approach..."' >> docker-entrypoint.sh && \
    echo '    npx prisma migrate reset --force || echo "Migration reset failed"' >> docker-entrypoint.sh && \
    echo '  }' >> docker-entrypoint.sh && \
    echo 'else' >> docker-entrypoint.sh && \
    echo '  echo "Database exists, ensuring schema is current..."' >> docker-entrypoint.sh && \
    echo '  npx prisma db push || {' >> docker-entrypoint.sh && \
    echo '    echo "Schema push failed, trying migrations..."' >> docker-entrypoint.sh && \
    echo '    npx prisma migrate deploy || echo "Migration failed, continuing..."' >> docker-entrypoint.sh && \
    echo '  }' >> docker-entrypoint.sh && \
    echo 'fi' >> docker-entrypoint.sh && \
    echo '' >> docker-entrypoint.sh && \
    echo '# Start the Discord bot' >> docker-entrypoint.sh && \
    echo 'echo "Starting Discord Bot..."' >> docker-entrypoint.sh && \
    echo 'exec node index.js' >> docker-entrypoint.sh && \
    chmod +x docker-entrypoint.sh

# Switch to a non-root user for better security
USER node

# Start the bot using the entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]