// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readSecret } from './read-secret.js'

describe('readSecret', () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
    delete process.env.TEST_SECRET
    delete process.env.TEST_SECRET_FILE
  })

  it('prefers env var over file', async () => {
    process.env.TEST_SECRET = 'from-env'
    dir = await mkdtemp(join(tmpdir(), 'tahti-secret-'))
    const file = join(dir, 'secret.txt')
    await writeFile(file, 'from-file\n', 'utf8')
    process.env.TEST_SECRET_FILE = file
    expect(readSecret('TEST_SECRET', 'TEST_SECRET_FILE', 'default')).toBe('from-env')
  })

  it('reads trimmed value from file when env unset', async () => {
    dir = await mkdtemp(join(tmpdir(), 'tahti-secret-'))
    const file = join(dir, 'secret.txt')
    await writeFile(file, '  file-value  \n', 'utf8')
    process.env.TEST_SECRET_FILE = file
    expect(readSecret('TEST_SECRET', 'TEST_SECRET_FILE', 'default')).toBe('file-value')
  })

  it('falls back to default', () => {
    expect(readSecret('MISSING', 'MISSING_FILE', 'fallback')).toBe('fallback')
  })
})
