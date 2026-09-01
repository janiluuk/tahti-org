// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { SearchQuerySchema } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { performSearch } from '../discover/search.js'

/** True for a session-cookie login (unscoped — same access as the website) or
 * a personal API token that was minted with 'write'. False only for a
 * 'read'-only token. Every tool that mutates anything must check this before
 * touching data — there is no other enforcement for it (see the route's
 * `methodScopeCheckExempt` below). */
export function hasWriteAccess(request: FastifyRequest): boolean {
  return request.apiTokenScopes === null || request.apiTokenScopes.includes('write')
}

/** Builds a fresh MCP server + tool set for a single request, closed over
 * that request's authenticated user. A new instance per call (rather than
 * one long-lived server) is the SDK's documented pattern for stateless
 * transports, and matters more here than usual: it's the only thing
 * stopping one user's tool handlers from ever touching another user's
 * closure state. */
function buildServer(request: FastifyRequest): McpServer {
  const server = new McpServer({ name: 'tahti', version: '1.0.0' })

  server.registerTool(
    'search',
    {
      title: 'Search Tahti',
      description: 'Full-text search across public tracks, artists, and collections on Tahti.',
      inputSchema: SearchQuerySchema.shape,
    },
    async (args) => {
      const result = await performSearch(request.server.prisma, args)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  // Next slice: mutating tools (add-to-playlist, favorite, ...) register
  // here too, each starting with `if (!hasWriteAccess(request)) return
  // { isError: true, content: [{ type: 'text', text: 'This token is read-only.' }] }`.

  return server
}

const mcpRoute: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/mcp — MCP Streamable HTTP endpoint, stateless (one server
  // per request, no session id). Auth is the same personal API tokens as
  // /api/me/api-tokens (Authorization: Bearer tahti_...), or a session
  // cookie for testing from a signed-in browser tab. MCP is JSON-RPC over
  // POST for every call, including read-only ones, so this route is exempt
  // from the global read/write-by-HTTP-method gate in the auth plugin;
  // individual tools do their own scope check (see hasWriteAccess above).
  fastify.post(
    '/api/v1/mcp',
    {
      preHandler: requireAuth,
      config: { methodScopeCheckExempt: true },
      schema: {
        tags: ['mcp'],
        description: 'Model Context Protocol endpoint (Streamable HTTP, stateless)',
      },
    },
    async (request, reply) => {
      const server = buildServer(request)
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      reply.hijack()
      await server.connect(transport)
      await transport.handleRequest(request.raw, reply.raw, request.body)
      request.raw.on('close', () => {
        void transport.close()
        void server.close()
      })
    },
  )
}

export default mcpRoute
