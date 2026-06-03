# syntax=docker/dockerfile:1
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2024 Tahti ry <https://tahti.live>
#
# Build from repo root:
#   docker build -f apps/api/Dockerfile -t tahti/api .

FROM node:20-alpine
RUN apk add --no-cache python3 make g++ && \
    corepack enable && corepack prepare pnpm@9 --activate && \
    npm install -g tsx@4

WORKDIR /app

# Workspace manifests first for layer caching (pnpm needs all of them)
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json     ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json             ./apps/api/
COPY apps/worker/package.json          ./apps/worker/
COPY apps/web/package.json             ./apps/web/
COPY services/orchestrator/package.json ./services/orchestrator/

RUN pnpm install --frozen-lockfile

# Source (after install for better layer caching)
COPY packages/db/src     ./packages/db/src
COPY packages/db/prisma  ./packages/db/prisma
COPY packages/shared/src ./packages/shared/src
COPY apps/api/src        ./apps/api/src

# Generate Prisma client into node_modules/.prisma
RUN pnpm --filter @tahti/db db:generate

ENV NODE_ENV=production PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3001/health || exit 1

CMD ["tsx", "apps/api/src/index.ts"]
