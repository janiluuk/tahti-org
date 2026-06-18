# syntax=docker/dockerfile:1
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# Build from repo root:
#   docker build -f services/orchestrator/Dockerfile -t tahti/orchestrator .

FROM node:24-alpine
RUN apk add --no-cache docker-cli openssl && \
    corepack enable && corepack prepare pnpm@9 --activate && \
    npm install -g tsx@4

WORKDIR /app

# Workspace manifests — all packages needed for pnpm install resolution
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json      ./packages/db/
COPY packages/shared/package.json  ./packages/shared/
COPY apps/api/package.json         ./apps/api/
COPY apps/worker/package.json      ./apps/worker/
COPY apps/web/package.json         ./apps/web/
COPY services/orchestrator/package.json ./services/orchestrator/
COPY scripts/copy-ffmpeg-core.mjs scripts/check-node-version.mjs ./scripts/

RUN pnpm install --frozen-lockfile

COPY packages/db/src     ./packages/db/src
COPY packages/db/prisma  ./packages/db/prisma
COPY packages/shared/src ./packages/shared/src
COPY services/orchestrator/src ./services/orchestrator/src

RUN pnpm --filter @tahti/db db:generate

ENV NODE_ENV=production PORT=3003
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3003/health || exit 1

CMD ["tsx", "services/orchestrator/src/index.ts"]
