# Multi-stage build for optimized production image

# ================================
# Build Stage
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install all dependencies (including devDependencies for build)
RUN yarn install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN yarn build

# ================================
# Production Stage  
# ================================
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S proxy -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy configuration files
COPY .env-example ./

# Create logs directory with proper permissions
RUN mkdir -p logs && \
    chown -R proxy:nodejs /app

# Switch to non-root user
USER proxy

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "const http = require('http'); \
    http.get('http://localhost:7777/health', (res) => { \
        if (res.statusCode === 200 || res.statusCode === 503) process.exit(0); \
        else process.exit(1); \
    }).on('error', () => process.exit(1));"

# Expose port
EXPOSE 7777

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]
