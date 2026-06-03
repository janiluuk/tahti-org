// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { hashPassword } from './password.js'
import { createSession } from './session.js'
import { collectPlatformMetrics, renderPlatformMetricLines } from './platform-metrics.js'

const PREFIX = 'plat-metrics-'

describe('platform-metrics', () => {
  let userId: string

  afterAll(async () => {
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  })

  it('counts registered users and sessions started today', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}@example.com`,
        username: `${PREFIX}user`,
        displayName: 'Metrics',
        passwordHash: await hashPassword('test-password-12'),
      },
    })
    userId = user.id
    await createSession(prisma, user.id)

    const snap = await collectPlatformMetrics(prisma)
    expect(snap.registeredUsers).toBeGreaterThan(0)
    expect(snap.activeUsersToday).toBeGreaterThan(0)

    const text = renderPlatformMetricLines(snap).join('\n')
    expect(text).toContain('tahti_users_registered_total')
    expect(text).toContain('tahti_users_active_today')
  })
})
