// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Socket } from 'node:net'

/** STREAM-010: telnet command registered in liquidsoap-channel.liq.template */
export const LIQUIDSOAP_GRACEFUL_SHUTDOWN_COMMAND = 'graceful_shutdown'

/** STREAM-012: telnet command registered in both .liq templates — returns the
 * current rotation-source metadata's "filename" (a presigned CDN URL), or "". */
export const LIQUIDSOAP_NOW_PLAYING_COMMAND = 'now_playing'

export const LIQUIDSOAP_TELNET_PORT = parseInt(process.env.LIQUIDSOAP_TELNET_PORT ?? '19000', 10)

/** Fade duration in liquidsoap template + buffer before docker stop. */
export const LIQUIDSOAP_FADE_SEC = parseInt(process.env.LIQUIDSOAP_FADE_SEC ?? '4', 10)

/**
 * Sends a command to a channel's Liquidsoap telnet server over the docker
 * network (container_name:port) rather than shelling `nc` into the target
 * container — the savonet/liquidsoap image ships no netcat binary at all
 * (confirmed against the real v2.2.5 image: `docker exec ... nc ...` fails
 * with "not found" every single time). Requires the .liq template to set
 * settings.server.telnet.bind_addr.set("0.0.0.0") — the Liquidsoap default
 * (127.0.0.1) only accepts connections from inside the same container, which
 * a plain TCP connection from the orchestrator's own container is not.
 */
export function sendLiquidsoapTelnetCommand(
  containerName: string,
  command: string,
  port = LIQUIDSOAP_TELNET_PORT,
  timeoutMs = 3000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    let buffer = ''

    const finish = (fn: () => void) => {
      socket.removeAllListeners()
      socket.destroy()
      fn()
    }

    socket.setTimeout(timeoutMs)
    socket.once('timeout', () => {
      finish(() => reject(new Error(`telnet timeout connecting to ${containerName}`)))
    })
    socket.once('error', (err) => finish(() => reject(err)))
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      // Liquidsoap's telnet server terminates every response with a bare "END"
      // line — wait for it rather than resolving on the first data event, since
      // a larger response can arrive across multiple TCP packets.
      if (/(^|\n)END\r?\n?$/.test(buffer)) finish(() => resolve(buffer))
    })

    socket.connect(port, containerName, () => {
      socket.write(`${command}\n`)
    })
  })
}

/** Liquidsoap's telnet server terminates every command's response with a bare
 * "END" line — strip it and any surrounding whitespace to get the raw value. */
export function parseLiquidsoapTelnetResponse(raw: string): string {
  return raw
    .split('\n')
    .filter((line) => line.trim() !== 'END')
    .join('\n')
    .trim()
}

export function liquidsoapGracefulShutdownWaitMs(fadeSec = LIQUIDSOAP_FADE_SEC): number {
  return (fadeSec + 2) * 1000
}
