// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { ChatReactSchema, ChatAnnouncementSchema, ChatBanSchema, ChatTokenSchema } from './chat.js'

describe('ChatReactSchema', () => {
  it('accepts allowed emoji', () => {
    expect(ChatReactSchema.safeParse({ emoji: '🔥' }).success).toBe(true)
  })

  it('rejects unknown emoji', () => {
    expect(ChatReactSchema.safeParse({ emoji: '😀' }).success).toBe(false)
  })
})

describe('ChatAnnouncementSchema', () => {
  it('rejects empty body', () => {
    expect(ChatAnnouncementSchema.safeParse({ body: '   ' }).success).toBe(false)
  })

  it('rejects body over 500 chars', () => {
    expect(ChatAnnouncementSchema.safeParse({ body: 'x'.repeat(501) }).success).toBe(false)
  })
})

describe('ChatTokenSchema', () => {
  it('rejects empty handle', () => {
    expect(ChatTokenSchema.safeParse({ handle: '  ' }).success).toBe(false)
  })
})

describe('ChatBanSchema', () => {
  it('requires hex fingerprint', () => {
    expect(ChatBanSchema.safeParse({ fingerprintHash: 'not-hex!' }).success).toBe(false)
    expect(ChatBanSchema.safeParse({ fingerprintHash: 'abc123def456' }).success).toBe(true)
  })
})
