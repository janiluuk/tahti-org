// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'

describe('hashPassword', () => {
  it('produces an argon2id hash', async () => {
    const hash = await hashPassword('mysecretpassword')
    expect(hash).toMatch(/^\$argon2id\$/)
  })

  it('produces different hashes for the same input (salted)', async () => {
    const hash1 = await hashPassword('samepassword')
    const hash2 = await hashPassword('samepassword')
    expect(hash1).not.toBe(hash2)
  })
})

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('correctpassword')
    expect(await verifyPassword(hash, 'correctpassword')).toBe(true)
  })

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('correctpassword')
    expect(await verifyPassword(hash, 'wrongpassword')).toBe(false)
  })
})
