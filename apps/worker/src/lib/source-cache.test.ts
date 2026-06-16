// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const { downloadToFile } = vi.hoisted(() => ({
  downloadToFile: vi.fn(),
}))

vi.mock('../lib/minio.js', () => ({ downloadToFile }))

import { downloadSourceCached } from './source-cache.js'

describe('downloadSourceCached', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reuses a cached copy on the second download', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tahti-source-cache-test-'))
    try {
      downloadToFile.mockImplementation(async (_key: string, dest: string) => {
        await writeFile(dest, 'cached-audio-bytes')
      })

      const dest1 = join(dir, 'first')
      const dest2 = join(dir, 'second')
      await downloadSourceCached('raw/test/source.flac', dest1)
      await downloadSourceCached('raw/test/source.flac', dest2)

      expect(downloadToFile).toHaveBeenCalledTimes(1)
      expect(await readFile(dest2, 'utf8')).toBe('cached-audio-bytes')
    } finally {
      await rm(dir, { recursive: true, force: true })
      await mkdir(join(tmpdir(), 'tahti-source-cache'), { recursive: true }).catch(() => {})
    }
  })
})
