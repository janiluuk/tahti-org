// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, afterEach } from 'vitest'
import { uploadToMixcloud } from '@tahti/mixcloud'

describe('@tahti/mixcloud stub mode', () => {
  const original = process.env.MIXCLOUD_CLIENT_ID

  afterEach(() => {
    if (original === undefined) delete process.env.MIXCLOUD_CLIENT_ID
    else process.env.MIXCLOUD_CLIENT_ID = original
  })

  it('returns a stub URL when MIXCLOUD_CLIENT_ID is unset outside production', async () => {
    delete process.env.MIXCLOUD_CLIENT_ID
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
    const result = await uploadToMixcloud({
      accessToken: 'fake',
      name: 'Test Mix',
      audioPath: '/dev/null',
    })
    expect(result.url).toMatch(/^https:\/\/www\.mixcloud\.com\/stub\//)
    expect(result.key).toMatch(/^\/stub\//)
    process.env.NODE_ENV = prevEnv
  })

  it('refuses stub upload in production', async () => {
    delete process.env.MIXCLOUD_CLIENT_ID
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    await expect(
      uploadToMixcloud({
        accessToken: 'fake',
        name: 'Test Mix',
        audioPath: '/dev/null',
      }),
    ).rejects.toThrow(/refusing stub Mixcloud upload/)
    process.env.NODE_ENV = prevEnv
  })
})
