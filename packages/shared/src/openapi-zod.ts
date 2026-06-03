// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { zodToJsonSchema } from 'zod-to-json-schema'
import type { z } from 'zod'

/** Convert a Zod schema to an OpenAPI 3.1 response object for Fastify route `schema.response`. */
export function openApiResponse(
  schema: z.ZodTypeAny,
  name: string,
): { 200: Record<string, unknown> } {
  return {
    200: zodToJsonSchema(schema, {
      name,
      target: 'openApi3',
      $refStrategy: 'none',
    }) as Record<string, unknown>,
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
