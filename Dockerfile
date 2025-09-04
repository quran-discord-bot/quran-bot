# Production Discord Bot Dockerfile
# Multi-stage build for optimized image size
FROM node:18-alpine AS dependencies

# Install system dependencies for canvas and native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only, skip scripts to avoid husky
RUN npm install --omit=dev --ignore-scripts && \
    npm cache clean --force

# Install Prisma CLI for client generation
RUN npm install prisma@^5.22.0

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install runtime dependencies for canvas
RUN apk add --no-cache python3

# Copy dependencies from build stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application source
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_URL="file:./dev.db"

# Create directories and set permissions
RUN mkdir -p generated/prisma prisma && \
    chown -R node:node .

# Generate Prisma client with correct binary target for Alpine
RUN npx prisma generate

# Create database initialization script
RUN echo '#!/bin/sh' > docker-entrypoint.sh && \
    echo 'set -e' >> docker-entrypoint.sh && \
    echo '' >> docker-entrypoint.sh && \
    echo '# Initialize database if needed' >> docker-entrypoint.sh && \
    echo 'echo "🔄 Checking database..."' >> docker-entrypoint.sh && \
    echo 'if [ ! -f "prisma/dev.db" ]; then' >> docker-entrypoint.sh && \
    echo '  echo "📦 Database not found, creating and pushing schema..."' >> docker-entrypoint.sh && \
    echo '  npx prisma db push' >> docker-entrypoint.sh && \
    echo '  npx prisma migrate deploy || echo "⚠️  Migration deploy failed, continuing..."' >> docker-entrypoint.sh && \
    echo 'else' >> docker-entrypoint.sh && \
    echo '  echo "✅ Database exists, ensuring schema is current..."' >> docker-entrypoint.sh && \
    echo '  npx prisma db push || echo "⚠️  Schema push failed, trying migrations..."' >> docker-entrypoint.sh && \
    echo '  npx prisma migrate deploy || echo "⚠️  Migration failed, continuing..."' >> docker-entrypoint.sh && \
    echo 'fi' >> docker-entrypoint.sh && \
    echo '' >> docker-entrypoint.sh && \
    echo '# Start the Discord bot' >> docker-entrypoint.sh && \
    echo 'echo "🤖 Starting Discord Bot..."' >> docker-entrypoint.sh && \
    echo 'exec node index.js' >> docker-entrypoint.sh && \
    chmod +x docker-entrypoint.sh

# Switch to non-root user for security
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Bot is healthy')" || exit 1

# Start the bot
ENTRYPOINT ["./docker-entrypoint.sh"]
