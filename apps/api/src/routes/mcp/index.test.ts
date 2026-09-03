// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'mcp-test-'

describe('MCP endpoint', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let baseUrl: string
  let userId: string
  let readToken: string
  let writeToken: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
    })
    userId = artist.id
    const cookie = await sessionCookieFor(prisma, artist.id)

    // Public data for the search tool to find.
    const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: artist.id } })
    await prisma.sound.create({
      data: {
        channelId: channel.id,
        title: `${PREFIX}unique track title`,
        isPublic: true,
        status: 'READY',
        durationSec: 120,
      },
    })

    const address = await app.listen({ port: 0, host: '127.0.0.1' })
    baseUrl = address

    const mintToken = async (scopes: string[]) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/me/api-tokens',
        headers: { cookie },
        payload: { name: `mcp-${scopes.join('-')}`, scopes },
      })
      return res.json().token as string
    }
    readToken = await mintToken(['read'])
    writeToken = await mintToken(['read', 'write'])
  })

  afterAll(async () => {
    await prisma.apiToken.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function connectedClient(token: string) {
    const transport = new StreamableHTTPClientTransport(new URL('/api/v1/mcp', baseUrl), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    })
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    await client.connect(transport)
    return client
  }

  it('rejects a request with no token', async () => {
    const res = await fetch(new URL('/api/v1/mcp', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    expect(res.status).toBe(401)
  })

  it('lists the search tool', async () => {
    const client = await connectedClient(readToken)
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name)).toContain('search')
    await client.close()
  })

  it('runs a search with a read-only token and finds the seeded track', async () => {
    const client = await connectedClient(readToken)
    const result = await client.callTool({
      name: 'search',
      arguments: { q: `${PREFIX}unique`, type: 'tracks', count: 5 },
    })
    expect(result.isError).not.toBe(true)
    const text = (result.content as Array<{ type: string; text?: string }>)[0]?.text ?? ''
    const parsed = JSON.parse(text) as { tracks: Array<{ title: string }> }
    expect(parsed.tracks.some((t) => t.title === `${PREFIX}unique track title`)).toBe(true)
    await client.close()
  })

  it('also works with a write-scoped token (search has no scope restriction)', async () => {
    const client = await connectedClient(writeToken)
    const result = await client.callTool({ name: 'search', arguments: { q: PREFIX, count: 1 } })
    expect(result.isError).not.toBe(true)
    await client.close()
  })
})
