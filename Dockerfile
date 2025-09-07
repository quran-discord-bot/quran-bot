# =========================================================================================
# BUILDER STAGE: Install dependencies and compile native modules
# =========================================================================================
FROM node:18-alpine AS builder

# Install build tools needed to compile native modules from source
RUN apk add --no-cache build-base python3

WORKDIR /app

# Copy only package files to leverage Docker's layer caching
COPY package*.json ./

# Install ALL dependencies (including dev for Prisma) and build
# We need dev dependencies here for `prisma generate`
# RUN npm install --omit=dev --ignore-scripts && \
RUN npm install && \
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
COPY docker-entrypoint.sh ./

# Set environment variable for production
ENV NODE_ENV=production

# Make entrypoint script executable and set up permissions
RUN chmod +x docker-entrypoint.sh

# Switch to a non-root user for better security
# USER node

# Start the bot using the entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]