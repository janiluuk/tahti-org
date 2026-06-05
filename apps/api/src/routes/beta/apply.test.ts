// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/email.js', () => ({
  sendBetaApplicationEmail: vi.fn().mockResolvedValue(undefined),
}))

import { sendBetaApplicationEmail } from '../../lib/email.js'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'

describe('POST /api/beta/apply', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({
      where: { subject: { startsWith: 'Beta application:' } },
    })
    await prisma.betaApplication.deleteMany({
      where: { email: 'beta-applicant@example.com' },
    })
    await app.close()
  })

  it('accepts application and emails support inbox', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/beta/apply',
      headers: { origin: 'https://tahti.live' },
      payload: {
        name: 'DJ Test',
        email: 'beta-applicant@example.com',
        artistType: 'DJ / live electronics',
        links: ['https://soundcloud.com/example', 'https://bandcamp.com/example'],
        message: 'OBS + Mixxx setup',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { ok: boolean; ticketId?: string }
    expect(body.ok).toBe(true)
    expect(body.ticketId).toBeTruthy()

    expect(sendBetaApplicationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'DJ Test',
        email: 'beta-applicant@example.com',
        source: 'website',
      }),
    )

    const ticket = await prisma.supportTicket.findFirst({
      where: { contactEmail: 'beta-applicant@example.com' },
    })
    expect(ticket?.subject).toBe('Beta application: DJ Test')

    const application = await prisma.betaApplication.findFirst({
      where: { email: 'beta-applicant@example.com' },
    })
    expect(application?.status).toBe('PENDING')
    expect(application?.name).toBe('DJ Test')
    expect(application?.links).toBe('https://soundcloud.com/example\nhttps://bandcamp.com/example')
  })

  it('rejects invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/beta/apply',
      payload: {
        name: 'Bad',
        email: 'not-an-email',
        artistType: 'DJ',
      },
    })
    expect(res.statusCode).toBe(400)
  })
})
