// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TimeoutError } from 'redis'

const { mockCreateClient, fakeClient } = vi.hoisted(() => {
  const fakeClient = {
    isOpen: true,
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
  }
  return { mockCreateClient: vi.fn(() => fakeClient), fakeClient }
})

vi.mock('redis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('redis')>()),
  createClient: mockCreateClient,
}))

vi.mock('../config.js', () => ({
  config: {
    nodeEnv: 'production',
    redisUrl: 'redis://test:6379',
    redisCommandTimeoutMs: 500,
    redisSlowBypassMs: 5000,
  },
}))

import {
  closeRedisClient,
  getOptionalRedisClient,
  getRedisClient,
  noteRedisFailure,
} from './redis.js'

describe('redis client', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.useFakeTimers()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await closeRedisClient()
    mockCreateClient.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    warnSpy.mockRestore()
  })

  it('creates the client with a per-command timeout', async () => {
    await getRedisClient()
    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'redis://test:6379',
      commandOptions: { timeout: 500 },
    })
  })

  it('bypasses optional Redis use for a window after a command timeout', async () => {
    expect(await getOptionalRedisClient()).toBe(fakeClient)

    noteRedisFailure(new TimeoutError('Command timeout'))
    expect(await getOptionalRedisClient()).toBeNull()
    expect(await getRedisClient()).toBe(fakeClient)

    vi.advanceTimersByTime(5000)
    expect(await getOptionalRedisClient()).toBe(fakeClient)
  })

  it('does not bypass on non-timeout errors', async () => {
    noteRedisFailure(new Error('WRONGTYPE'))
    expect(await getOptionalRedisClient()).toBe(fakeClient)
  })
})
