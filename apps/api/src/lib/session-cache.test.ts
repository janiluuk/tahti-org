// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }))

vi.mock('./redis.js', () => {
  const client = {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value)
      return 'OK'
    },
    del: async (key: string) => store.delete(key),
  }
  return {
    getRedisClient: async () => client,
    getOptionalRedisClient: async () => client,
    noteRedisFailure: () => undefined,
  }
})

import type { PrismaClient } from '@tahti/db'
import { validateSession } from './session.js'

describe('validateSession with the Redis cache on', () => {
  it('serves a signed-in user from the cache with dates and byte counts intact', async () => {
    const row = {
      id: 'sess-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      user: {
        id: 'user-1',
        username: 'aino',
        deletedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        softTargetBytes: 524288000n,
        hiddenCeilingBytes: 53687091200n,
        storageUsedBytes: 1234n,
      },
    }
    const findUnique = vi.fn().mockResolvedValue(row)
    const prisma = { session: { findUnique } } as unknown as PrismaClient

    const fresh = await validateSession(prisma, 'sess-1')
    expect(fresh?.user.storageUsedBytes).toBe(1234n)
    await vi.waitFor(() => expect(store.has('session:sess-1')).toBe(true))

    const cached = await validateSession(prisma, 'sess-1')
    expect(findUnique).toHaveBeenCalledTimes(1)
    expect(cached?.user.storageUsedBytes).toBe(1234n)
    expect(cached?.user.hiddenCeilingBytes).toBe(53687091200n)
    expect(cached?.user.createdAt).toBeInstanceOf(Date)
    expect(cached?.expiresAt).toBeInstanceOf(Date)
  })
})
