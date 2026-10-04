// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const sendMail = vi.hoisted(() => vi.fn())
const db = vi.hoisted(() => ({
  findDraft: vi.fn(),
  updateDraft: vi.fn(),
  findSends: vi.fn(),
  updateSend: vi.fn(),
  deleteSend: vi.fn(),
}))

vi.hoisted(() => {
  process.env.API_URL = 'https://api.example.test/'
  process.env.APP_URL = 'https://app.example.test'
})

vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}))

vi.mock('@tahti/db', () => ({
  actorDisplayName: (user: { username: string; displayName: string | null }) =>
    user.displayName && !user.displayName.includes('@') ? user.displayName : user.username,
  prisma: {
    newsletterDraft: { findUnique: db.findDraft, update: db.updateDraft },
    newsletterSend: { findMany: db.findSends, update: db.updateSend, delete: db.deleteSend },
  },
}))

import { newsletterUnsubscribeLinks, processNewsletterDispatch } from './newsletter-dispatch.js'

describe('newsletter dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendMail.mockResolvedValue(undefined)
    db.findDraft.mockResolvedValue({
      id: 'draft-1',
      subject: 'Hello',
      bodyMd: 'New mix is up',
      user: { username: 'night-artist', displayName: 'artist@example.com' },
    })
    db.findSends.mockResolvedValue([
      {
        id: 'send-1',
        subscriber: {
          id: 's1',
          email: 'fan@example.com',
          unsubToken: 'tok-1',
          unsubscribedAt: null,
        },
      },
      {
        id: 'send-2',
        subscriber: {
          id: 's2',
          email: 'gone@example.com',
          unsubToken: 'tok-2',
          unsubscribedAt: new Date(),
        },
      },
    ])
  })

  it('points one-click unsubscribe at the API, which can take the POST', () => {
    expect(newsletterUnsubscribeLinks('tok-1')).toEqual({
      pageUrl: 'https://app.example.test/newsletter/unsubscribe/tok-1',
      headers: {
        'List-Unsubscribe': '<https://api.example.test/api/newsletter/unsubscribe/tok-1>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
  })

  it('skips people who unsubscribed after the send was queued', async () => {
    await processNewsletterDispatch({ data: { draftId: 'draft-1' } } as Job)

    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({ to: 'fan@example.com' })
    expect(db.deleteSend).toHaveBeenCalledWith({ where: { id: 'send-2' } })
    expect(db.updateSend).toHaveBeenCalledTimes(1)
  })

  it('never uses an email address as the sender name', async () => {
    await processNewsletterDispatch({ data: { draftId: 'draft-1' } } as Job)

    const mail = sendMail.mock.calls[0]?.[0] as { from: string; text: string }
    expect(mail.from.startsWith('night-artist via Tahti')).toBe(true)
    expect(mail.text).toContain('you subscribed to night-artist.')
    expect(mail.text).not.toContain('artist@example.com')
  })
})
