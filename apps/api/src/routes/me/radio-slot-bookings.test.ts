// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'

const TEST_EMAIL_PREFIX = 'radio-slot-test-'
const USERNAME_A = 'radio-slot-testuser-a'
const USERNAME_B = 'radio-slot-testuser-b'

function nextHour(hoursFromNow: number): Date {
  const d = new Date()
  d.setUTCMinutes(0, 0, 0)
  d.setUTCHours(d.getUTCHours() + hoursFromNow)
  return d
}

describe('radio slot bookings', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookieA: string
  let cookieB: string
  let cookieNoChannel: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    for (const username of [USERNAME_A, USERNAME_B]) {
      await prisma.user.create({
        data: {
          email: `${TEST_EMAIL_PREFIX}${username}@example.com`,
          passwordHash,
          username,
          displayName: `Radio Slot ${username}`,
          emailVerifiedAt: new Date(),
          membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
          channel: {
            create: {
              slug: username,
              liveSourceMount: `/live/${username}`,
              liveSourcePass: 'dummypass',
              liveSourcePassHash: 'dummy',
              rtmpStreamKey: 'dummyslug__dummykey',
              rtmpStreamKeyHash: 'dummy',
            },
          },
        },
      })
    }
    await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}nochannel@example.com`,
        passwordHash,
        username: 'radio-slot-testuser-nochannel',
        displayName: 'No Channel',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
      },
    })

    async function login(email: string) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password: 'testpassword' },
      })
      return res.cookies.find((c) => c.name === 'tahti_session')!.value
    }
    cookieA = await login(`${TEST_EMAIL_PREFIX}${USERNAME_A}@example.com`)
    cookieB = await login(`${TEST_EMAIL_PREFIX}${USERNAME_B}@example.com`)
    cookieNoChannel = await login(`${TEST_EMAIL_PREFIX}nochannel@example.com`)
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/radio-slot-bookings?from=2026-01-01T00:00:00.000Z&to=2026-01-02T00:00:00.000Z',
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects creating a booking for a user with no channel', async () => {
    const startAt = nextHour(1)
    const endAt = nextHour(2)
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/radio-slot-bookings',
      cookies: { tahti_session: cookieNoChannel },
      payload: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects a non-hour-aligned start time', async () => {
    const startAt = nextHour(1)
    startAt.setUTCMinutes(15)
    const endAt = nextHour(2)
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/radio-slot-bookings',
      cookies: { tahti_session: cookieA },
      payload: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a booking longer than 2 hours', async () => {
    const startAt = nextHour(1)
    const endAt = nextHour(4)
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/radio-slot-bookings',
      cookies: { tahti_session: cookieA },
      payload: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a booking in the past', async () => {
    const startAt = nextHour(-2)
    const endAt = nextHour(-1)
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/radio-slot-bookings',
      cookies: { tahti_session: cookieA },
      payload: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a booking too far in advance', async () => {
    const startAt = nextHour(24 * 60)
    const endAt = nextHour(24 * 60 + 1)
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/radio-slot-bookings',
      cookies: { tahti_session: cookieA },
      payload: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
    })
    expect(res.statusCode).toBe(400)
  })

  let bookingId: string

  it('creates a valid 2-hour booking', async () => {
    const startAt = nextHour(5)
    const endAt = nextHour(7)
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/radio-slot-bookings',
      cookies: { tahti_session: cookieA },
      payload: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), note: 'Live set' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.note).toBe('Live set')
    expect(body.channelSlug).toBe(USERNAME_A)
    expect(body.isMine).toBe(true)
    bookingId = body.id
  })

  it('rejects an overlapping booking from another artist', async () => {
    const startAt = nextHour(6)
    const endAt = nextHour(8)
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/radio-slot-bookings',
      cookies: { tahti_session: cookieB },
      payload: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
    })
    expect(res.statusCode).toBe(409)
  })

  it('allows a back-to-back booking that does not overlap', async () => {
    const startAt = nextHour(7)
    const endAt = nextHour(8)
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/radio-slot-bookings',
      cookies: { tahti_session: cookieB },
      payload: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
    })
    expect(res.statusCode).toBe(201)
  })

  it('lists bookings in range for both artists, flagging isMine correctly', async () => {
    const from = nextHour(0).toISOString()
    const to = nextHour(24).toISOString()
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/radio-slot-bookings?from=${from}&to=${to}`,
      cookies: { tahti_session: cookieA },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ id: string; isMine: boolean; channelSlug: string }>
    expect(body).toHaveLength(2)
    const mine = body.find((b) => b.id === bookingId)
    expect(mine?.isMine).toBe(true)
    const other = body.find((b) => b.id !== bookingId)
    expect(other?.isMine).toBe(false)
    expect(other?.channelSlug).toBe(USERNAME_B)
  })

  it('forbids cancelling someone else’s booking', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/radio-slot-bookings/${bookingId}`,
      cookies: { tahti_session: cookieB },
    })
    expect(res.statusCode).toBe(404)
  })

  it('cancels your own booking', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/radio-slot-bookings/${bookingId}`,
      cookies: { tahti_session: cookieA },
    })
    expect(res.statusCode).toBe(204)

    const from = nextHour(0).toISOString()
    const to = nextHour(24).toISOString()
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/me/radio-slot-bookings?from=${from}&to=${to}`,
      cookies: { tahti_session: cookieA },
    })
    const body = listRes.json() as Array<{ id: string }>
    expect(body.find((b) => b.id === bookingId)).toBeUndefined()
  })

  it('enforces the per-channel upcoming-bookings cap', async () => {
    let lastStatus = 0
    for (let i = 0; i < 6; i++) {
      const startAt = nextHour(10 + i * 3)
      const endAt = nextHour(11 + i * 3)
      const res = await app.inject({
        method: 'POST',
        url: '/api/me/radio-slot-bookings',
        cookies: { tahti_session: cookieA },
        payload: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
      })
      lastStatus = res.statusCode
    }
    expect(lastStatus).toBe(409)
  })
})
