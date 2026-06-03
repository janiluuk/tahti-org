# syntax=docker/dockerfile:1
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# Build from repo root:
#   docker build -f apps/worker/Dockerfile -t tahti/worker .

FROM node:20-alpine
RUN apk add --no-cache ffmpeg aubio openssl && \
    corepack enable && corepack prepare pnpm@9 --activate && \
    npm install -g tsx@4

WORKDIR /app

COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json     ./packages/db/
COPY packages/ledger/package.json ./packages/ledger/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json             ./apps/api/
COPY apps/worker/package.json          ./apps/worker/
COPY apps/web/package.json             ./apps/web/
COPY services/orchestrator/package.json ./services/orchestrator/

RUN pnpm install --frozen-lockfile

COPY packages/db/src     ./packages/db/src
COPY packages/db/prisma  ./packages/db/prisma
COPY packages/ledger/src ./packages/ledger/src
COPY packages/shared/src ./packages/shared/src
COPY apps/worker/src     ./apps/worker/src

RUN pnpm --filter @tahti/db db:generate

ENV NODE_ENV=production
CMD ["tsx", "apps/worker/src/index.ts"]
