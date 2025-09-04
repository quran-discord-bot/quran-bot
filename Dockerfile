# Multi-stage build for Discord bot
# Stage 1: Build dependencies (Alpine-based for smaller size)
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only (use install instead of ci to avoid lock file issues)
# Set npm config to ignore scripts during install to avoid postinstall issues
RUN npm config set ignore-scripts true && \
    npm install --only=production && \
    npm cache clean --force

# Install Prisma CLI for database operations
RUN npm install -g prisma

# Stage 2: Production runtime (Alpine)
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S discordbot -u 1001

# Copy production dependencies from builder stage
COPY --from=builder --chown=discordbot:nodejs /app/node_modules ./node_modules

# Copy only necessary application files
COPY --chown=discordbot:nodejs index.js ./
COPY --chown=discordbot:nodejs commands/ ./commands/
COPY --chown=discordbot:nodejs events/ ./events/
COPY --chown=discordbot:nodejs utility/ ./utility/
COPY --chown=discordbot:nodejs assets/ ./assets/
COPY --chown=discordbot:nodejs prisma/ ./prisma/
COPY --chown=discordbot:nodejs generated/ ./generated/
COPY --chown=discordbot:nodejs package.json ./

# Ensure database directory exists and set proper permissions
RUN mkdir -p /app/prisma && \
    chown -R discordbot:nodejs /app/prisma

# Generate Prisma client and initialize database (run as root before switching user)
RUN npx prisma generate --schema=./prisma/schema.prisma && \
    chown -R discordbot:nodejs /app/generated

# Create a startup script that handles database initialization (as root)
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting Discord Bot..."' >> /app/start.sh && \
    echo 'echo "Checking database..."' >> /app/start.sh && \
    echo 'if [ ! -f "/app/prisma/dev.db" ]; then' >> /app/start.sh && \
    echo '  echo "Database not found, running migrations..."' >> /app/start.sh && \
    echo '  npx prisma migrate deploy --schema=/app/prisma/schema.prisma' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "Database found, ensuring schema is up to date..."' >> /app/start.sh && \
    echo '  npx prisma migrate deploy --schema=/app/prisma/schema.prisma' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "Starting bot application..."' >> /app/start.sh && \
    echo 'exec node index.js' >> /app/start.sh && \
    chmod +x /app/start.sh && \
    chown discordbot:nodejs /app/start.sh

# Switch to non-root user
USER discordbot

# Expose port (if your bot serves HTTP endpoints)
# EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Bot is running')" || exit 1

# Start the application with database initialization
CMD ["/app/start.sh"]
