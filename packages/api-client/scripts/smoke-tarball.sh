#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>

# Installs a packed @tahti/api-client tarball into a throwaway npm project
# (outside the pnpm workspace) and checks what an external consumer sees:
# the published exports typecheck under NodeNext, a wrong path or response
# field is a compile error, and the ESM entry resolves and talks to a server.
#
# Usage: smoke-tarball.sh <path/to/tahti-api-client-x.y.z.tgz> [workdir]
set -euo pipefail

tarball="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
workdir="${2:-$(mktemp -d)}"
mkdir -p "$workdir"
cd "$workdir"

cat > package.json <<'JSON'
{ "name": "api-client-smoke", "private": true, "type": "module" }
JSON
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "strict": true,
    "outDir": "out"
  },
  "files": ["smoke.ts"]
}
JSON
cat > smoke.ts <<'TS'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createTahtiClient, type paths } from '@tahti/api-client'

type TokenList =
  paths['/api/me/api-tokens']['get']['responses'][200]['content']['application/json']

const fixture: TokenList = [
  {
    id: 't1',
    name: 'smoke',
    tokenPrefix: 'tahti_ab',
    scopes: ['read'],
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date(0).toISOString(),
  },
]

const server = createServer((req, res) => {
  const ok = req.url === '/api/me/api-tokens' && req.headers.authorization === 'Bearer tahti_smoke'
  res.writeHead(ok ? 200 : 404, { 'content-type': 'application/json' })
  res.end(JSON.stringify(ok ? fixture : { error: 'not found' }))
})
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
const { port } = server.address() as AddressInfo

const api = createTahtiClient({ baseUrl: `http://127.0.0.1:${port}`, token: 'tahti_smoke' })

async function typeOnly(): Promise<void> {
  // @ts-expect-error unknown paths must not typecheck
  await api.GET('/api/definitely-not-a-route')
  const { data } = await api.GET('/api/me/api-tokens')
  // @ts-expect-error response fields are typed from the schema
  data?.[0]?.notAField
}
void typeOnly

const { data, error } = await api.GET('/api/me/api-tokens')
server.close()
if (error || data?.[0]?.tokenPrefix !== 'tahti_ab') {
  console.error('smoke failed', { data, error })
  process.exit(1)
}
console.log(`ok: ${data.length} token(s) via @tahti/api-client`)
TS

npm install --no-audit --no-fund --silent "$tarball" typescript@5 @types/node@24 >/dev/null
npx tsc -p tsconfig.json
node out/smoke.js
