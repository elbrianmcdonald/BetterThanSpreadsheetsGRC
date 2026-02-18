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

# Build Next.js application (standalone output)
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install Chromium and its dependencies for Puppeteer PDF generation
# Then apply all available security patches (ffmpeg, libpng, libsndfile, libyaml, etc.)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && apk upgrade --no-cache

# Tell Puppeteer to use the installed Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Upgrade npm to fix node-tar CVEs (CVE-2026-23745/23950/24842) bundled in npm 10.x
# Then install Prisma CLI + tsx globally for runtime migrations and seeding
# Prisma pinned to v6 to match project schema format
RUN npm install -g npm@latest prisma@6 tsx

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes server + minimal node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema (needed for runtime db push)
COPY --from=builder /app/prisma ./prisma

# Copy entrypoint (sed strips Windows \r line endings for cross-platform safety)
COPY docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# Switch to non-root user
USER nextjs

# Expose port 3000
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
