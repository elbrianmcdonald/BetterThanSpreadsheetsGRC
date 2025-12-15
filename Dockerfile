# Multi-stage Dockerfile for BetterThanSpreadsheetsGRC Next.js App

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Skip env validation during Docker build
ENV SKIP_ENV_VALIDATION=true

# Copy package files
COPY package.json package-lock.json ./

# Copy Prisma schema (needed for postinstall prisma generate)
COPY prisma ./prisma

# Install dependencies (runs postinstall: prisma generate)
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/src ./src

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# Switch to non-root user
USER nextjs

# Expose port 3000
EXPOSE 3000

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
