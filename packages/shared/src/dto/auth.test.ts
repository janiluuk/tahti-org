// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { RegisterSchema, LoginSchema, VerifyEmailSchema } from './auth.js'

describe('RegisterSchema', () => {
  it('accepts valid input', () => {
    const result = RegisterSchema.safeParse({
      email: 'artist@example.com',
      password: 'securepassword123',
      username: 'testartist',
      displayName: 'Test Artist',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = RegisterSchema.safeParse({
      email: 'not-an-email',
      password: 'securepassword123',
      username: 'testartist',
      displayName: 'Test Artist',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = RegisterSchema.safeParse({
      email: 'artist@example.com',
      password: 'short',
      username: 'testartist',
      displayName: 'Test Artist',
    })
    expect(result.success).toBe(false)
  })

  it('rejects username with invalid characters', () => {
    const result = RegisterSchema.safeParse({
      email: 'artist@example.com',
      password: 'securepassword123',
      username: 'UPPERCASE',
      displayName: 'Test Artist',
    })
    expect(result.success).toBe(false)
  })

  it('rejects username that is too short', () => {
    const result = RegisterSchema.safeParse({
      email: 'artist@example.com',
      password: 'securepassword123',
      username: 'x',
      displayName: 'Test Artist',
    })
    expect(result.success).toBe(false)
  })

  it('accepts username with hyphens and underscores', () => {
    const result = RegisterSchema.safeParse({
      email: 'artist@example.com',
      password: 'securepassword123',
      username: 'test-artist_2',
      displayName: 'Test Artist',
    })
    expect(result.success).toBe(true)
  })
})

describe('LoginSchema', () => {
  it('accepts valid input', () => {
    const result = LoginSchema.safeParse({
      email: 'artist@example.com',
      password: 'anypassword',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing password', () => {
    const result = LoginSchema.safeParse({
      email: 'artist@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('VerifyEmailSchema', () => {
  it('accepts a token', () => {
    const result = VerifyEmailSchema.safeParse({ token: 'abc123' })
    expect(result.success).toBe(true)
  })

  it('rejects empty token', () => {
    const result = VerifyEmailSchema.safeParse({ token: '' })
    expect(result.success).toBe(false)
  })
})
