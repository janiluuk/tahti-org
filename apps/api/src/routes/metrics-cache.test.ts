// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../server.js'
import { config } from '../config.js'
import { clearAdminStatsCache } from '../lib/admin-stats-cache.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

const PREFIX = 'metrics-cache-'

describe('/metrics reuses the database aggregates', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const ttlBefore = config.metricsCacheSec
  let created = 0

  async function registeredUsers() {
    const res = await app.inject({ method: 'GET', url: '/metrics' })
    expect(res.statusCode).toBe(200)
    const match = /^tahti_users_registered_total (\d+)$/m.exec(res.body)
    return Number(match?.[1])
  }

  async function addUser() {
    created += 1
    await createTestArtist(prisma, {
      email: `${PREFIX}${created}@example.com`,
      username: `${PREFIX}${created}`,
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterEach(() => {
    config.metricsCacheSec = ttlBefore
    clearAdminStatsCache()
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('serves the same gauges within the TTL', async () => {
    config.metricsCacheSec = 60
    const [first, concurrent] = await Promise.all([registeredUsers(), registeredUsers()])
    await addUser()
    expect(concurrent).toBe(first)
    expect(await registeredUsers()).toBe(first)
  })

  it('recomputes every scrape when the TTL is 0', async () => {
    config.metricsCacheSec = 0
    const before = await registeredUsers()
    await addUser()
    expect(await registeredUsers()).toBe(before + 1)
  })
})
