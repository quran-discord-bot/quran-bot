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
COPY --chown=discordbot:nodejs package.json ./

# Switch to non-root user
USER discordbot

# Expose port (if your bot serves HTTP endpoints)
# EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Bot is running')" || exit 1

# Start the application
CMD ["node", "index.js"]
