// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// M16 — Tahti Radio meta-stream service.
//
// Runs a perpetual pick loop every 60 seconds. When a live channel is selected
// it writes a Liquidsoap telnet command to update the HLS relay source.
// The actual Liquidsoap process is expected to be a sibling container.
//
// Public status endpoint: GET /now-playing (used by /api/v1/radio on the API).

import Fastify from 'fastify'
import net from 'node:net'
import { pickChannel, type PickedChannel } from './picker.js'

const PORT = parseInt(process.env.PORT ?? '3004', 10)
const LIQUIDSOAP_TELNET_HOST = process.env.LIQUIDSOAP_TELNET_HOST ?? 'localhost'
const LIQUIDSOAP_TELNET_PORT = parseInt(process.env.LIQUIDSOAP_TELNET_PORT ?? '1234', 10)
const PICK_INTERVAL_MS = 60_000

let current: PickedChannel | null = null

// Send a command to the Liquidsoap telnet server
async function liqCommand(cmd: string): Promise<void> {
  return new Promise((resolve) => {
    const sock = net.createConnection(LIQUIDSOAP_TELNET_PORT, LIQUIDSOAP_TELNET_HOST)
    sock.on('connect', () => {
      sock.write(`${cmd}\nquit\n`)
      sock.end()
    })
    sock.on('close', resolve)
    sock.on('error', (e) => {
      console.warn('[radio] liquidsoap telnet error:', e.message)
      resolve()
    })
  })
}

async function runPickLoop(): Promise<void> {
  const picked = await pickChannel()

  if (!picked) {
    // No live channels — signal Liquidsoap to fall back to placeholder
    await liqCommand('tahti_radio.skip')
    current = null
    console.log('[radio] no live channels — placeholder active')
  } else if (!current || current.channelId !== picked.channelId) {
    // Switch to new channel
    await liqCommand(`tahti_radio.uri ${picked.hlsUrl}`)
    current = picked
    console.log(`[radio] now relaying: ${picked.slug} (${picked.artistName})`)
  }
}

// Kick off the pick loop
async function startLoop(): Promise<void> {
  await runPickLoop()
  setInterval(() => {
    runPickLoop().catch((e) => console.error('[radio] pick loop error:', e))
  }, PICK_INTERVAL_MS)
}

const fastify = Fastify({ logger: true })

fastify.get('/health', async () => ({ ok: true }))

// GET /now-playing — consumed by /api/v1/radio on the API service
fastify.get('/now-playing', async (_request, reply) => {
  if (!current) {
    return reply.send({ live: false, channel: null })
  }
  return reply.send({
    live: true,
    channel: {
      slug: current.slug,
      artistName: current.artistName,
      hlsUrl: current.hlsUrl,
    },
  })
})

await fastify.listen({ port: PORT, host: '0.0.0.0' })
startLoop().catch((e) => console.error('[radio] startup error:', e))
