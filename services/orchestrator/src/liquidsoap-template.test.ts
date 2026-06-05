// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const templatePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../infra/liquidsoap-channel.liq.template',
)

describe('liquidsoap channel template', () => {
  it('exposes M20 dual-bitrate HLS paths expected by stream-quality.ts', async () => {
    const template = await readFile(templatePath, 'utf8')
    expect(template).toContain('stream-mp3-192')
    expect(template).toContain('stream-flac')
    expect(template).not.toContain('opus_128k')
  })

  it('buffers archive fallback before live-or-archive switch (ARTIST-003)', async () => {
    const template = await readFile(templatePath, 'utf8')
    expect(template).toContain('delay(delay=3., archive)')
  })

  it('registers telnet graceful shutdown fade (STREAM-010)', async () => {
    const template = await readFile(templatePath, 'utf8')
    expect(template).toContain('graceful_shutdown')
    expect(template).toContain('radio_out')
    expect(template).toContain('settings.server.telnet.set(true)')
    expect(template).toContain('fade.out')
  })
})
