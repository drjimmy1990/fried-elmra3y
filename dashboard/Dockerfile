# 1. Base image (Node 22 LTS)
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 2. Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 3. Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Next.js embeds NEXT_PUBLIC_* variables at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG APP_BASE_URL
ARG META_GRAPH_VERSION

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV APP_BASE_URL=$APP_BASE_URL
ENV META_GRAPH_VERSION=$META_GRAPH_VERSION

RUN npm run build

# 4. Production Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Copy standalone output and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Harden production container: create cache mountpoint and strip network downloaders/package managers
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next/cache \
    && rm -rf /sbin/apk /usr/bin/wget /usr/bin/curl /var/cache/apk/* || true

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
