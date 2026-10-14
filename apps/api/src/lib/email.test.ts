// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { BETA_SUPPORT_INBOX } from '@tahti/shared'

const nodemailerSendMail = vi.fn().mockResolvedValue(undefined)

vi.mock('../config.js', () => ({
  config: {
    email: {
      host: 'mailhog',
      port: 1025,
      user: '',
      pass: '',
      from: 'Tahti <noreply@tahti.live>',
    },
    sourceRepoUrl: 'https://github.com/tahtiapp/tahti',
  },
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: nodemailerSendMail }),
  },
}))

import { sendBetaApplicationEmail, sendGovernanceMeetingNoticeEmail } from './email.js'

describe('sendBetaApplicationEmail', () => {
  beforeEach(() => {
    nodemailerSendMail.mockClear()
  })

  it('delivers to support@tahti.live with applicant reply-to', async () => {
    await sendBetaApplicationEmail({
      name: 'DJ Test',
      email: 'artist@example.com',
      artistType: 'DJ',
      links: 'https://soundcloud.com/a\nhttps://bandcamp.com/b',
      source: 'app',
    })

    expect(nodemailerSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: BETA_SUPPORT_INBOX,
        replyTo: 'artist@example.com',
        subject: 'Beta application: DJ Test',
      }),
    )
    expect(nodemailerSendMail.mock.calls[0]?.[0]?.text).toContain('https://soundcloud.com/a')
    expect(nodemailerSendMail.mock.calls[0]?.[0]?.text).toContain('https://bandcamp.com/b')
  })
})

describe('sendGovernanceMeetingNoticeEmail', () => {
  beforeEach(() => {
    nodemailerSendMail.mockClear()
  })

  it('lists the numbered agenda when there is one', async () => {
    const notice = {
      to: 'member@example.com',
      displayName: 'Member',
      meetingTitle: 'Annual meeting',
      meetingType: 'GENERAL',
      scheduledAt: null,
      location: null,
      remoteUrl: null,
    }
    await sendGovernanceMeetingNoticeEmail({
      ...notice,
      agendaItems: [
        { position: 1, title: 'Opening' },
        { position: 2, title: 'Budget <draft>' },
      ],
    })
    const mail = nodemailerSendMail.mock.calls[0]?.[0]
    expect(mail?.text).toContain('Agenda:\n1. Opening\n2. Budget <draft>')
    expect(mail?.html).toContain('<ol><li>Opening</li><li>Budget &lt;draft></li></ol>')

    await sendGovernanceMeetingNoticeEmail(notice)
    expect(nodemailerSendMail.mock.calls[1]?.[0]?.text).not.toContain('Agenda:')
  })
})
