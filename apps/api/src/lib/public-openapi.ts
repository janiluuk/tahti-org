// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Tags omitted from the public OpenAPI surface (ops / board / internal). */
export const PUBLIC_OPENAPI_EXCLUDED_TAGS = new Set(['admin', 'internal'])

/** Path prefixes never published on the public docs surface. */
const EXCLUDED_PATH_PREFIXES = ['/api/admin', '/internal', '/metrics', '/docs']

type OpenApiPathItem = Record<string, unknown>
type OpenApiSpec = {
  openapi?: string
  info?: Record<string, unknown>
  servers?: Array<Record<string, unknown>>
  paths?: Record<string, OpenApiPathItem>
  components?: Record<string, unknown>
  tags?: Array<{ name: string; description?: string }>
  [key: string]: unknown
}

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])

function pathIsExcluded(path: string): boolean {
  return EXCLUDED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function operationTags(op: unknown): string[] {
  if (!op || typeof op !== 'object') return []
  const tags = (op as { tags?: unknown }).tags
  return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : []
}

function operationIsPublic(op: unknown): boolean {
  const tags = operationTags(op)
  if (tags.length === 0) return true
  return !tags.some((t) => PUBLIC_OPENAPI_EXCLUDED_TAGS.has(t))
}

/**
 * Derive a public OpenAPI 3 document from the full Fastify swagger() spec.
 * Keeps listener/artist-facing routes; drops admin + internal.
 */
export function toPublicOpenApi(
  full: OpenApiSpec,
  opts: { serverUrl: string; generatedAt?: string } = { serverUrl: 'https://api.tahti.live' },
): OpenApiSpec {
  const paths: Record<string, OpenApiPathItem> = {}
  for (const [path, item] of Object.entries(full.paths ?? {})) {
    if (pathIsExcluded(path) || !item || typeof item !== 'object') continue
    const next: OpenApiPathItem = {}
    for (const [key, value] of Object.entries(item)) {
      if (!HTTP_METHODS.has(key.toLowerCase())) {
        next[key] = value
        continue
      }
      if (operationIsPublic(value)) next[key] = value
    }
    const hasMethod = Object.keys(next).some((k) => HTTP_METHODS.has(k.toLowerCase()))
    if (hasMethod) paths[path] = next
  }

  const tags = (full.tags ?? []).filter((t) => t?.name && !PUBLIC_OPENAPI_EXCLUDED_TAGS.has(t.name))

  const info = {
    ...(full.info ?? { title: 'Tahti API', version: '1' }),
    description: [
      'Public Tahti broadcasting API (OpenAPI 3). AGPL-3.0 — https://github.com/tahtiapp/tahti',
      '',
      '## Base URL',
      'Production: `https://api.tahti.live` — local: `http://localhost:3001`',
      'Nuclear beta (`beta.tahti.live`) uses this same production API via `/tahti-api/`.',
      '',
      '## Authentication',
      'Session cookie `tahti_session` from `POST /api/auth/login` (and TOTP step when enabled).',
      'Many listen / channel / profile / catalog / transparency / radio endpoints need no auth.',
      'Artist studio and `/api/me/*` routes require a logged-in session.',
      '',
      '## Rate limits',
      'Default ~120 req/min/IP; auth and chat-token routes ~10 req/min/IP.',
      'Downloads use separate fingerprint/IP hourly and daily caps.',
      'See `docs/technical/rate-limit-policy.md` in the repo.',
      '',
      '## Docs surfaces',
      '- This document: public routes only (admin/internal omitted)',
      '- Ops Swagger UI: `GET /docs` (HTTP basic auth)',
      '- Machine-readable: `GET /api/openapi.json`',
      opts.generatedAt ? `\n_Generated ${opts.generatedAt}_` : '',
    ].join('\n'),
  }

  return {
    openapi: full.openapi ?? '3.1.0',
    info,
    servers: [
      { url: opts.serverUrl, description: 'This environment' },
      { url: 'https://api.tahti.live', description: 'Production' },
      { url: 'http://localhost:3001', description: 'Local development' },
    ],
    tags,
    paths,
    components: full.components,
  }
}

/** Minimal Scalar shell — loads the public OpenAPI JSON (CDN, no PHP / no static dump). */
export function renderPublicApiDocsHtml(openapiUrl: string): string {
  const safeUrl = openapiUrl.replace(/"/g, '&quot;')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark light" />
  <title>Tahti API</title>
  <link rel="icon" href="https://tahti.live/favicon.ico" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-url="${safeUrl}"
    data-configuration='${JSON.stringify({
      theme: 'kepler',
      layout: 'modern',
      darkMode: true,
      hideModels: false,
      hideDownloadButton: false,
      defaultHttpClient: { targetKey: 'js', clientKey: 'fetch' },
      metaData: { title: 'Tahti API' },
    }).replace(/'/g, '&#39;')}'
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.64.1/dist/browser/standalone.js" crossorigin></script>
</body>
</html>
`
}
