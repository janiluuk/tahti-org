// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { zodToJsonSchema } from 'zod-to-json-schema'
import type { z } from 'zod'

/** Convert a Zod schema to an OpenAPI 3.1 response object for Fastify route `schema.response`. */
function zodToOpenApiJson(schema: z.ZodTypeAny, name: string): Record<string, unknown> {
  return zodToJsonSchema(schema, {
    name,
    target: 'openApi3',
    $refStrategy: 'none',
  }) as Record<string, unknown>
}

export function openApiResponse(
  schema: z.ZodTypeAny,
  name: string,
): { 200: Record<string, unknown> } {
  return { 200: zodToOpenApiJson(schema, name) }
}

/** Multiple success status codes (e.g. 200 checkout URL vs 201 dev activation). */
export function openApiResponses(
  entries: Array<{ status: number; schema: z.ZodTypeAny; name: string }>,
): Record<number, Record<string, unknown>> {
  const out: Record<number, Record<string, unknown>> = {}
  for (const { status, schema, name } of entries) {
    out[status] = zodToOpenApiJson(schema, name)
  }
  return out
}

/** HTTP redirect with no response body (AGPL /source, etc.). */
export function openApiRedirectResponse(status = 302): Record<number, { type: 'null' }> {
  return {
    [status]: { type: 'null' },
  }
}

/** Register Zod schemas under OpenAPI `components.schemas` (PLAT-014). */
export function zodOpenApiComponents(
  schemas: Record<string, z.ZodTypeAny>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [name, schema] of Object.entries(schemas)) {
    const json = zodToJsonSchema(schema, {
      name,
      target: 'openApi3',
      $refStrategy: 'none',
    }) as Record<string, unknown>
    delete json.$schema
    out[name] = json
  }
  return out
}
