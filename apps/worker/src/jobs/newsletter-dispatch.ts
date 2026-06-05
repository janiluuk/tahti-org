// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import nodemailer from 'nodemailer'
import { smtpTransportOptions } from '@tahti/shared'
import { prisma } from '@tahti/db'

const SMTP_HOST = process.env.SMTP_HOST ?? 'localhost'
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '1025', 10)
const SMTP_USER = process.env.SMTP_USER ?? ''
const SMTP_PASS = process.env.SMTP_PASS ?? ''
const SMTP_FROM = process.env.SMTP_FROM ?? 'Tahti <noreply@tahti.live>'
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const SOURCE_REPO = 'https://github.com/tahtiapp/tahti'
const BATCH_SIZE = 50

let _transport: nodemailer.Transporter | null = null
function getTransport(): nodemailer.Transporter {
  if (!_transport) {
    _transport = nodemailer.createTransport(
      smtpTransportOptions({
        host: SMTP_HOST,
        port: SMTP_PORT,
        user: SMTP_USER,
        pass: SMTP_PASS,
      }),
    )
  }
  return _transport
}

export async function processNewsletterDispatch(job: Job): Promise<void> {
  const { draftId } = job.data as { draftId: string }

  const draft = await prisma.newsletterDraft.findUnique({
    where: { id: draftId },
    include: { user: { select: { displayName: true, username: true } } },
  })

  if (!draft) throw new Error(`NewsletterDraft ${draftId} not found`)

  // Process in batches to avoid memory pressure on large lists
  let processed = 0
  let cursor: string | undefined

  for (;;) {
    const sends = await prisma.newsletterSend.findMany({
      where: { draftId, state: 'QUEUED' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { subscriber: { select: { id: true, email: true, unsubToken: true } } },
    })

    if (sends.length === 0) break

    for (const send of sends) {
      const { subscriber } = send
      const unsubUrl = `${APP_URL}/newsletter/unsubscribe/${subscriber.unsubToken}`
      const plainText = [
        draft.bodyMd,
        '',
        '─',
        `You are receiving this because you subscribed to ${draft.user.displayName}.`,
        `Unsubscribe: ${unsubUrl}`,
        `Source code: ${SOURCE_REPO}`,
      ].join('\n')

      try {
        await getTransport().sendMail({
          from: `${draft.user.displayName} via Tahti <${SMTP_FROM}>`,
          to: subscriber.email,
          subject: draft.subject,
          text: plainText,
          headers: {
            'List-Unsubscribe': `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'X-Source-Code': SOURCE_REPO,
          },
        })

        await prisma.newsletterSend.update({
          where: { id: send.id },
          data: { state: 'SENT', sentAt: new Date() },
        })
      } catch (err) {
        await prisma.newsletterSend.update({
          where: { id: send.id },
          data: { state: 'FAILED' },
        })
        console.error(`[newsletter] failed to send to ${subscriber.email}:`, err)
      }

      processed++
    }

    cursor = sends[sends.length - 1].id
    if (sends.length < BATCH_SIZE) break
  }

  await prisma.newsletterDraft.update({
    where: { id: draftId },
    data: { state: 'SENT', sentAt: new Date() },
  })

  console.log(`[newsletter] dispatch done: draftId=${draftId} sent=${processed}`)
}
