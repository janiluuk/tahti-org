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

const PREFIX = 'mcp-tools-test-'

type Content = Array<{ type: string; text?: string }>

describe('MCP library tools', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let baseUrl: string
  let listenerId: string
  let artistId: string
  let soundId: string
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
    artistId = artist.id
    const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: artist.id } })
    const sound = await prisma.sound.create({
      data: {
        channelId: channel.id,
        title: `${PREFIX}track`,
        isPublic: true,
        status: 'READY',
        durationSec: 120,
      },
    })
    soundId = sound.id

    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: `${PREFIX}listener`,
      tier: 'ARTIST',
    })
    listenerId = listener.id
    const cookie = await sessionCookieFor(prisma, listener.id)

    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' })

    const mintToken = async (scopes: string[]) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/me/api-tokens',
        headers: { cookie },
        payload: { name: `mcp-tools-${scopes.join('-')}`, scopes },
      })
      return res.json().token as string
    }
    readToken = await mintToken(['read'])
    writeToken = await mintToken(['read', 'write'])
  })

  afterAll(async () => {
    await prisma.apiToken.deleteMany({ where: { userId: listenerId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function call(token: string, name: string, args: Record<string, unknown> = {}) {
    const transport = new StreamableHTTPClientTransport(new URL('/api/v1/mcp', baseUrl), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    })
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    await client.connect(transport)
    const result = await client.callTool({ name, arguments: args })
    await client.close()
    const text = (result.content as Content)[0]?.text ?? ''
    return { isError: result.isError === true, text }
  }

  it('lists the library tools next to search', async () => {
    const transport = new StreamableHTTPClientTransport(new URL('/api/v1/mcp', baseUrl), {
      requestInit: { headers: { Authorization: `Bearer ${readToken}` } },
    })
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    await client.connect(transport)
    const { tools } = await client.listTools()
    await client.close()
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'add_to_playlist',
        'create_playlist',
        'follow_artist',
        'like_track',
        'my_likes',
        'my_playlists',
        'search',
      ].sort(),
    )
  })

  it('refuses every write with a read-only token and changes nothing', async () => {
    for (const [name, args] of [
      ['like_track', { channelSlug: `${PREFIX}artist`, trackId: soundId }],
      ['follow_artist', { username: `${PREFIX}artist` }],
      ['create_playlist', { name: 'Nope' }],
      ['add_to_playlist', { playlistSlug: 'x', trackId: soundId }],
    ] as const) {
      const result = await call(readToken, name, args)
      expect(result.isError, name).toBe(true)
      expect(result.text).toContain('read-only')
    }
    expect(await prisma.soundLike.count({ where: { userId: listenerId } })).toBe(0)
    expect(await prisma.artistFollow.count({ where: { followerUserId: listenerId } })).toBe(0)
  })

  it('likes a track, lists it in my_likes, and removes the like', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: artistId } })
    const liked = await call(writeToken, 'like_track', {
      channelSlug: channel.slug,
      trackId: soundId,
    })
    expect(liked.isError, liked.text).toBe(false)

    const likes = await call(readToken, 'my_likes')
    expect(likes.isError, likes.text).toBe(false)
    expect(likes.text).toContain(`${PREFIX}track`)

    const unliked = await call(writeToken, 'like_track', {
      channelSlug: channel.slug,
      trackId: soundId,
      liked: false,
    })
    expect(unliked.isError, unliked.text).toBe(false)
    expect(await prisma.soundLike.count({ where: { userId: listenerId } })).toBe(0)
  })

  it('follows and unfollows an artist', async () => {
    const followed = await call(writeToken, 'follow_artist', { username: `${PREFIX}artist` })
    expect(followed.isError, followed.text).toBe(false)
    expect(await prisma.artistFollow.count({ where: { followerUserId: listenerId } })).toBe(1)
    const unfollowed = await call(writeToken, 'follow_artist', {
      username: `${PREFIX}artist`,
      follow: false,
    })
    expect(unfollowed.isError, unfollowed.text).toBe(false)
    expect(await prisma.artistFollow.count({ where: { followerUserId: listenerId } })).toBe(0)
  })

  it('creates a private playlist, adds a track, and lists it', async () => {
    const created = await call(writeToken, 'create_playlist', { name: `${PREFIX}mix` })
    expect(created.isError, created.text).toBe(false)
    const playlist = await prisma.collection.findFirstOrThrow({
      where: { name: `${PREFIX}mix` },
    })
    expect(playlist.isPublic).toBe(false)

    const added = await call(writeToken, 'add_to_playlist', {
      playlistSlug: playlist.slug,
      trackId: soundId,
    })
    expect(added.isError, added.text).toBe(false)
    expect(await prisma.collectionItem.count({ where: { collectionId: playlist.id } })).toBe(1)

    const mine = await call(readToken, 'my_playlists')
    expect(mine.text).toContain(playlist.slug)
  })

  it("passes the route's own error through", async () => {
    const result = await call(writeToken, 'follow_artist', { username: `${PREFIX}nobody` })
    expect(result.isError).toBe(true)
    expect(result.text.length).toBeGreaterThan(0)
  })
})
