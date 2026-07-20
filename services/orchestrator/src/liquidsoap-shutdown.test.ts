// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  LIQUIDSOAP_GRACEFUL_SHUTDOWN_COMMAND,
  LIQUIDSOAP_NOW_PLAYING_COMMAND,
  LIQUIDSOAP_TELNET_PORT,
  liquidsoapGracefulShutdownShell,
  liquidsoapGracefulShutdownWaitMs,
  liquidsoapNowPlayingShell,
  parseLiquidsoapTelnetResponse,
} from './liquidsoap-shutdown.js'

describe('liquidsoapGracefulShutdownShell', () => {
  it('sends graceful_shutdown via telnet inside the container', () => {
    expect(liquidsoapGracefulShutdownShell('tahti-channel-demo')).toBe(
      `docker exec tahti-channel-demo sh -c 'echo ${LIQUIDSOAP_GRACEFUL_SHUTDOWN_COMMAND} | nc -w 2 127.0.0.1 ${LIQUIDSOAP_TELNET_PORT}'`,
    )
  })
})

describe('liquidsoapGracefulShutdownWaitMs', () => {
  it('waits fade duration plus buffer before docker stop', () => {
    expect(liquidsoapGracefulShutdownWaitMs(4)).toBe(6000)
  })
})

describe('liquidsoapNowPlayingShell', () => {
  it('sends now_playing via telnet inside the container', () => {
    expect(liquidsoapNowPlayingShell('tahti-channel-demo')).toBe(
      `docker exec tahti-channel-demo sh -c 'echo ${LIQUIDSOAP_NOW_PLAYING_COMMAND} | nc -w 2 127.0.0.1 ${LIQUIDSOAP_TELNET_PORT}'`,
    )
  })
})

describe('parseLiquidsoapTelnetResponse', () => {
  it('strips the trailing END line', () => {
    expect(parseLiquidsoapTelnetResponse('https://cdn.tahti.live/tahti/mp3/a.mp3\nEND\n')).toBe(
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
