// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createServer, type Server } from 'node:net'
import { describe, it, expect, afterEach } from 'vitest'
import {
  liquidsoapGracefulShutdownWaitMs,
  parseLiquidsoapTelnetResponse,
  sendLiquidsoapTelnetCommand,
} from './liquidsoap-shutdown.js'

describe('liquidsoapGracefulShutdownWaitMs', () => {
  it('waits fade duration plus buffer before docker stop', () => {
    expect(liquidsoapGracefulShutdownWaitMs(4)).toBe(6000)
  })
})

describe('parseLiquidsoapTelnetResponse', () => {
  it('strips the trailing END line', () => {
    expect(parseLiquidsoapTelnetResponse('https://cdn.tahti.live/tahti/mp3/a.mp3\nEND\n')).toBe(
      'https://cdn.tahti.live/tahti/mp3/a.mp3',
    )
  })

  it('strips a CRLF-terminated END line, as the real telnet server sends', () => {
    expect(parseLiquidsoapTelnetResponse('https://cdn.tahti.live/tahti/mp3/a.mp3\r\nEND\r\n')).toBe(
      'https://cdn.tahti.live/tahti/mp3/a.mp3',
    )
  })

  it('returns empty string for an empty response', () => {
    expect(parseLiquidsoapTelnetResponse('\nEND\n')).toBe('')
  })

  it('handles a response with no trailing newline', () => {
    expect(parseLiquidsoapTelnetResponse('END')).toBe('')
  })
})

// Liquidsoap ships no netcat, so this talks to the telnet port directly over
// TCP (see sendLiquidsoapTelnetCommand) rather than shelling `nc` into the
// target container. A real TCP server here (not a mock) exercises the actual
// socket code — the same client code was additionally confirmed working live
// against the real savonet/liquidsoap:v2.2.5 image across two separate
// containers on a docker network before this was wired into production.
describe('sendLiquidsoapTelnetCommand', () => {
  let server: Server | undefined

  afterEach(() => {
    server?.close()
    server = undefined
  })

  function startFakeTelnetServer(respond: (command: string) => string): Promise<number> {
    return new Promise((resolve) => {
      server = createServer((socket) => {
        socket.on('data', (chunk) => {
          const command = chunk.toString('utf8').trim()
          socket.write(`${respond(command)}\r\nEND\r\n`)
        })
      })
      server.listen(0, '127.0.0.1', () => {
        const address = server!.address()
        resolve(typeof address === 'object' && address ? address.port : 0)
      })
    })
  }

  it('sends the command and returns the raw response including END', async () => {
    const port = await startFakeTelnetServer((cmd) =>
      cmd === 'now_playing' ? 'https://cdn.tahti.live/tahti/mp3/a.mp3' : '',
    )
    const raw = await sendLiquidsoapTelnetCommand('127.0.0.1', 'now_playing', port)
    expect(raw).toBe('https://cdn.tahti.live/tahti/mp3/a.mp3\r\nEND\r\n')
  })

  it('reflects back whatever command was sent', async () => {
    const port = await startFakeTelnetServer((cmd) => `echo:${cmd}`)
    const raw = await sendLiquidsoapTelnetCommand('127.0.0.1', 'graceful_shutdown', port)
    expect(parseLiquidsoapTelnetResponse(raw)).toBe('echo:graceful_shutdown')
  })

  it('rejects when nothing is listening on the port', async () => {
    await expect(sendLiquidsoapTelnetCommand('127.0.0.1', 'now_playing', 1, 500)).rejects.toThrow()
  })
})
