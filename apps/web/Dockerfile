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
COPY packages/ui/package.json     ./packages/ui/
COPY packages/audio-edit/package.json ./packages/audio-edit/
COPY apps/api/package.json             ./apps/api/
COPY apps/worker/package.json          ./apps/worker/
COPY apps/web/package.json             ./apps/web/
COPY services/orchestrator/package.json ./services/orchestrator/
COPY scripts/copy-ffmpeg-core.mjs scripts/check-node-version.mjs ./scripts/

RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────

FROM deps AS builder

# Next.js inlines NEXT_PUBLIC_* vars at build time, not runtime — pass the
# deployment's real cross-origin URLs as build args (see deploy.yml). Defaults
# here match the in-code fallbacks so a plain `docker build` still works.
ARG NEXT_PUBLIC_API_BASE=http://localhost:3001
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_CENTRIFUGO_WS=ws://localhost:8000/connection/websocket
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE} \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_CENTRIFUGO_WS=${NEXT_PUBLIC_CENTRIFUGO_WS} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json
COPY packages/shared/src ./packages/shared/src
COPY packages/audio-edit/src ./packages/audio-edit/src
COPY packages/ui/src     ./packages/ui/src
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
COPY packages/ui/package.json     ./packages/ui/
COPY packages/audio-edit/package.json ./packages/audio-edit/
COPY apps/api/package.json             ./apps/api/
COPY apps/worker/package.json          ./apps/worker/
COPY apps/web/package.json             ./apps/web/
COPY services/orchestrator/package.json ./services/orchestrator/
COPY scripts/copy-ffmpeg-core.mjs scripts/check-node-version.mjs ./scripts/

RUN pnpm install --frozen-lockfile --prod

# Shared/UI source needed for workspace symlink resolution at runtime
COPY packages/shared/src ./packages/shared/src
COPY packages/ui/src     ./packages/ui/src

# Compiled Next.js output + static assets
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY apps/web/public         ./apps/web/public
COPY apps/web/next.config.mjs ./apps/web/

USER nextjs
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

WORKDIR /app/apps/web
CMD ["pnpm", "start"]
