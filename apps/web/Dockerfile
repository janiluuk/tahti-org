# syntax=docker/dockerfile:1
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# Build from repo root:
#   docker build -f apps/web/Dockerfile -t tahti/web .

FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json     ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json             ./apps/api/
COPY apps/worker/package.json          ./apps/worker/
COPY apps/web/package.json             ./apps/web/
COPY services/orchestrator/package.json ./services/orchestrator/

RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────

FROM deps AS builder
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/src ./packages/shared/src
COPY apps/web/           ./apps/web/
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && pnpm build

# ── Runtime ───────────────────────────────────────────────────────────────────

FROM node:24-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9 --activate && \
    addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D nextjs
WORKDIR /app

# Reinstall only production deps
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json     ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json             ./apps/api/
COPY apps/worker/package.json          ./apps/worker/
COPY apps/web/package.json             ./apps/web/
COPY services/orchestrator/package.json ./services/orchestrator/

RUN pnpm install --frozen-lockfile --prod

# Shared source needed for workspace symlink resolution
COPY packages/shared/src ./packages/shared/src

# Compiled Next.js output + static assets
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY apps/web/public         ./apps/web/public
COPY apps/web/next.config.mjs ./apps/web/

USER nextjs
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

WORKDIR /app/apps/web
CMD ["pnpm", "start"]
