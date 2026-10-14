// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyRequest, InjectOptions } from 'fastify'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

type ToolResult = CallToolResult

const READ_ONLY: ToolResult = {
  isError: true,
  content: [
    { type: 'text', text: 'This token is read-only. Mint one with write access to do this.' },
  ],
}

function text(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] }
}

function errorText(statusCode: number, body: unknown): string {
  const message =
    body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : `Request failed (${statusCode})`
  return message
}

/** Runs one of the API's own routes as the caller: same credentials, same IP
 * for rate limits, so every rule that route enforces (visibility, blocks,
 * notifications, the read/write token gate) applies to the tool unchanged. */
export async function callRouteAs(
  request: FastifyRequest,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
): Promise<ToolResult> {
  const headers: Record<string, string> = {}
  if (request.headers.authorization) headers.authorization = request.headers.authorization
  if (request.headers.cookie) headers.cookie = request.headers.cookie
  const options: InjectOptions = { method, url, headers, remoteAddress: request.ip }
  if (payload) options.payload = payload
  const res = await request.server.inject(options)
  let body: unknown = null
  try {
    body = res.body ? JSON.parse(res.body) : null
  } catch {
    body = res.body
  }
  if (res.statusCode >= 400) {
    return { isError: true, content: [{ type: 'text', text: errorText(res.statusCode, body) }] }
  }
  return text(body ?? { ok: true })
}

const slug = z.string().min(1).max(200)

/** Library tools: the caller's likes, follows and playlists. Each mutating
 * tool checks `canWrite` first so a read-only token gets a clear message. */
export function registerLibraryTools(
  server: McpServer,
  request: FastifyRequest,
  canWrite: boolean,
): void {
  const enc = encodeURIComponent

  server.registerTool(
    'my_likes',
    {
      title: 'My liked tracks',
      description: 'The tracks you liked on Tahti, newest first.',
      inputSchema: { limit: z.number().int().min(1).max(100).optional() },
    },
    ({ limit }) => callRouteAs(request, 'GET', `/api/me/likes?limit=${limit ?? 50}`),
  )

  server.registerTool(
    'my_playlists',
    {
      title: 'My playlists',
      description: 'Your playlists and other collections, with their slugs for add_to_playlist.',
      inputSchema: {},
    },
    () => callRouteAs(request, 'GET', '/api/me/collections'),
  )

  server.registerTool(
    'like_track',
    {
      title: 'Like a track',
      description:
        'Like a track. Use the channelSlug and id of a track from search. liked: false removes the like.',
      inputSchema: { channelSlug: slug, trackId: slug, liked: z.boolean().optional() },
    },
    ({ channelSlug, trackId, liked }) => {
      if (!canWrite) return READ_ONLY
      return callRouteAs(
        request,
        liked === false ? 'DELETE' : 'POST',
        `/api/v1/c/${enc(channelSlug)}/sounds/${enc(trackId)}/like`,
      )
    },
  )

  server.registerTool(
    'follow_artist',
    {
      title: 'Follow an artist',
      description: 'Follow an artist by username. follow: false unfollows.',
      inputSchema: { username: slug, follow: z.boolean().optional() },
    },
    ({ username, follow }) => {
      if (!canWrite) return READ_ONLY
      return callRouteAs(
        request,
        follow === false ? 'DELETE' : 'POST',
        `/api/v1/artists/${enc(username)}/follow`,
      )
    },
  )

  server.registerTool(
    'create_playlist',
    {
      title: 'Create a playlist',
      description: 'Create a playlist. It is private unless visibility says otherwise.',
      inputSchema: {
        name: z.string().trim().min(1).max(100),
        visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
      },
    },
    ({ name, visibility }) => {
      if (!canWrite) return READ_ONLY
      const chosen = visibility ?? 'PRIVATE'
      return callRouteAs(request, 'POST', '/api/me/collections', {
        name,
        style: 'PLAYLIST',
        visibility: chosen === 'PRIVATE' ? 'DRAFT' : chosen,
      })
    },
  )

  server.registerTool(
    'add_to_playlist',
    {
      title: 'Add a track to a playlist',
      description:
        'Add a track (its id from search) to one of your playlists (its slug from my_playlists).',
      inputSchema: { playlistSlug: slug, trackId: slug },
    },
    ({ playlistSlug, trackId }) => {
      if (!canWrite) return READ_ONLY
      return callRouteAs(request, 'POST', `/api/me/collections/${enc(playlistSlug)}/items`, {
        soundId: trackId,
      })
    },
  )
}
