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
const rotationTemplatePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../infra/liquidsoap-rotation.liq.template',
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
    expect(template).toContain('delay(3., rotation)')
  })

  it('registers telnet graceful shutdown fade (STREAM-010)', async () => {
    const template = await readFile(templatePath, 'utf8')
    expect(template).toContain('graceful_shutdown')
    expect(template).toContain('radio_out')
    expect(template).toContain('settings.server.telnet.set(true)')
    expect(template).toContain('fade.out')
  })

  it('exposes Manage panel transport controls (skip/previous/pause/resume)', async () => {
    const template = await readFile(templatePath, 'utf8')
    // archive.skip is auto-registered by playlist(id="archive"); jump_queue.push
    // by request.queue(id="jump_queue") — neither needs its own server.register.
    expect(template).toContain('playlist(')
    expect(template).toContain('id="archive"')
    expect(template).toContain('request.queue(id="jump_queue")')
    expect(template).toContain('server.register(\n  "pause"')
    expect(template).toContain('server.register(\n  "resume"')
    // Pausing must never block a real live broadcast. Must check the raw
    // live_icecast, not the mksafe-wrapped live_source — mksafe makes
    // is_ready() always report true, which would make this predicate
    // permanently unreachable (see the fallback test below for the sibling
    // bug this exact mistake caused).
    expect(template).toContain('paused() and not source.is_ready(live_icecast)')
  })

  it('the live-or-rotation fallback checks the raw live_icecast, not the mksafe-wrapped live_source', async () => {
    const template = await readFile(templatePath, 'utf8')
    // Verified against the real savonet/liquidsoap:v2.2.5 binary: mksafe(s)
    // makes is_ready() unconditionally true (it silently substitutes its own
    // blank() when the wrapped source isn't ready, rather than reporting
    // not-ready). Feeding that into this fallback meant it always selected
    // live_source's slot and never fell through to rotation, even with a
    // fully-ready rotation source sitting right behind it — every channel
    // not currently live played silence (confirmed: -91dB) instead of its
    // archive. live_source (mksafe-wrapped) is still defined for the
    // RTMP-mirror mux, which genuinely needs an infallible source — just not
    // fed into this station-output fallback.
    expect(template).toContain('[live_icecast, rotation, blank()]')
    expect(template).not.toContain('[live_source, rotation, blank()]')
  })

  it('STREAM-013: registers the s3get protocol and reads extname from the URL path, not a HEAD probe', async () => {
    const template = await readFile(templatePath, 'utf8')
    // AWS SigV4 presigned URLs are GET-only — a HEAD probe against one always
    // 403s, so extname can never come from a content-type sniff here.
    expect(template).not.toContain('http.head(')
    expect(template).toContain('protocol.add(')
    expect(template).toContain('"s3get"')
    expect(template).toContain('normalize_url=false')
    expect(template).toContain('file.extension(leading_dot=true, dir_sep="/", path_only)')
  })
})

describe('liquidsoap rotation template', () => {
  it('STREAM-013: registers the same s3get protocol fix as the channel template', async () => {
    const template = await readFile(rotationTemplatePath, 'utf8')
    expect(template).not.toContain('http.head(')
    expect(template).toContain('protocol.add(')
    expect(template).toContain('"s3get"')
    expect(template).toContain('normalize_url=false')
    expect(template).toContain('file.extension(leading_dot=true, dir_sep="/", path_only)')
  })
})
