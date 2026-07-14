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
# Raise Node's heap to 4GB — default ~1.5GB OOMs during type-check on this codebase
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Bind to all interfaces. The Next.js standalone server defaults to localhost,
# which is unreachable from outside the container — docker-compose.yml happens to
# set HOSTNAME, but managed platforms (Azure Container Apps, ECS, Cloud Run) do
# not, and their health probes would fail against a localhost-only listener.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Install Chromium and its dependencies for Puppeteer PDF generation
# Then apply all available security patches (ffmpeg, libpng, libsndfile, libyaml, etc.)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    postgresql17-client \
    && apk upgrade --no-cache

# Tell Puppeteer to use the installed Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Upgrade npm to fix node-tar CVEs (CVE-2026-23745/23950/24842) bundled in npm 10.x.
# Pinned to the 11.x line, not @latest: npm 12 requires Node >=22 and hard-fails
# EBADENGINE on this image's Node 20. 11.x bundles the patched tar >=7.5.19.
# Then install Prisma CLI + tsx globally for runtime migrations and seeding.
# Prisma pinned to v7 to match the project's schema format (datasource without url).
RUN npm install -g npm@11 prisma@7 tsx

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (server + traced node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Overlay the builder's full node_modules on top of the trimmed standalone set.
# Next.js tracing covers the server (src/**) but not prisma/seed.ts, which
# imports @prisma/adapter-pg and its transitive deps. Rather than play
# whack-a-mole with individual COPY lines, ship the full dependency tree so
# `tsx prisma/seed.ts` and any other out-of-band scripts resolve cleanly.
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema (needed for runtime db push).
# prisma.config.ts is intentionally NOT copied: the entrypoint passes --url
# directly to `prisma db push`, bypassing the config file.
COPY --from=builder /app/prisma ./prisma

# Copy the dev-managed changelog. Read at request time by /changelog.
COPY --from=builder /app/CHANGELOG.md ./CHANGELOG.md

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
