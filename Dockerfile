# ─────────────────────────────────────────────────────────────
# Stage 1: base — pnpm + node
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# ─────────────────────────────────────────────────────────────
# Stage 2: deps — install all workspace dependencies
# ─────────────────────────────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json     ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────
# Stage 3: builder — build shared → server → web
# ─────────────────────────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/apps/web/node_modules    ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY . .

# Build shared package first
RUN pnpm --filter @wenchang/shared build

# Build server
RUN pnpm --filter @wenchang/server build

# Build Next.js (needs NEXT_PUBLIC_API_URL at build time if used in static pages)
# Pass a placeholder; runtime value is injected via env vars in Zeabur
ARG NEXT_PUBLIC_API_URL=/api/proxy
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @wenchang/web build

# ─────────────────────────────────────────────────────────────
# Stage 4: runner — lean production image
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# supervisor to run both processes
RUN apk add --no-cache supervisor

WORKDIR /app

# ── shared package (needed by server at runtime) ──────────────
COPY --from=builder /app/packages/shared/dist        ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

# ── server ────────────────────────────────────────────────────
COPY --from=builder /app/apps/server/dist          ./apps/server/dist
COPY --from=builder /app/apps/server/package.json  ./apps/server/package.json
COPY --from=builder /app/apps/server/node_modules  ./apps/server/node_modules

# keep upload / certificate dirs
RUN mkdir -p /app/apps/server/uploads /app/apps/server/certificates

# ── web ───────────────────────────────────────────────────────
COPY --from=builder /app/apps/web/.next          ./apps/web/.next
COPY --from=builder /app/apps/web/public         ./apps/web/public
COPY --from=builder /app/apps/web/package.json   ./apps/web/package.json
COPY --from=builder /app/apps/web/node_modules   ./apps/web/node_modules
COPY --from=builder /app/apps/web/next.config.ts ./apps/web/next.config.ts

# ── root node_modules (hoisted deps) ─────────────────────────
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# ── supervisor config ─────────────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Zeabur exposes a single port — Next.js listens on 3000, we expose that.
# The server listens on 4000 (internal only, proxied by Next.js).
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=4000
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
