// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import createClient, { type Client, type ClientOptions } from 'openapi-fetch'
import type { paths } from './schema.js'

export type { paths, components, operations } from './schema.js'
export type TahtiClient = Client<paths>

export interface TahtiClientOptions extends Omit<ClientOptions, 'baseUrl' | 'headers'> {
  /** e.g. https://api.tahti.live, or process.env.API_URL in server code. */
  baseUrl: string
  /** Personal API token (see POST /api/me/api-tokens) — sent as `Authorization: Bearer <token>`.
   * Mutually exclusive with `cookie` in practice, but both may be set; the API accepts either. */
  token?: string
  /** Raw `Cookie` header value, e.g. `tahti_session=...` — needed server-side (Next.js Server
   * Actions / Route Handlers don't forward the browser's cookie jar automatically; browsers
   * also block scripts from setting the `Cookie` header at all). In client components, omit
   * this and pass `credentials: 'include'` instead so the browser attaches its own cookie jar. */
  cookie?: string
}

/**
 * Typed client for the Tahti API, generated from apps/api's own OpenAPI schema
 * (see scripts/generate.mjs — regenerate with `pnpm --filter @tahti/api-client generate`
 * whenever routes change; turbo keeps this automatic for `dev`/`build`/`typecheck`).
 *
 * Server: createTahtiClient({ baseUrl: process.env.API_URL!, cookie: sessionHeader() })
 * Client: createTahtiClient({ baseUrl: NEXT_PUBLIC_API_BASE, credentials: 'include' })
 * Script: createTahtiClient({ baseUrl: 'https://api.tahti.live', token: 'tahti_...' })
 */
export function createTahtiClient(options: TahtiClientOptions): TahtiClient {
  const { baseUrl, token, cookie, ...rest } = options
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (cookie) headers.Cookie = cookie

  return createClient<paths>({ baseUrl, headers, ...rest })
}
