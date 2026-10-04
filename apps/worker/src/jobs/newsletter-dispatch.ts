// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import nodemailer from 'nodemailer'
import { smtpTransportOptions } from '@tahti/shared'
import { actorDisplayName, prisma } from '@tahti/db'

const SMTP_HOST = process.env.SMTP_HOST ?? 'localhost'
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '1025', 10)
const SMTP_USER = process.env.SMTP_USER ?? ''
const SMTP_PASS = process.env.SMTP_PASS ?? ''
const SMTP_FROM = process.env.SMTP_FROM ?? 'Tahti <noreply@tahti.live>'
const APP_URL = process.env.APP_URL ?? 'https://app.tahti.live'
const SOURCE_REPO = 'https://github.com/tahtiapp/tahti'
// Public address of the API. Mail providers POST the one-click unsubscribe
// to it; the web app page at APP_URL cannot take a POST.
const API_URL = process.env.API_URL?.replace(/\/$/, '')

/** Unsubscribe links for one subscriber: the page a person opens, and the
 * headers a mail provider uses for its own Unsubscribe button. One-click
 * (RFC 8058) is only announced when there is an API address to POST to. */
export function newsletterUnsubscribeLinks(unsubToken: string) {
  const pageUrl = `${APP_URL}/newsletter/unsubscribe/${unsubToken}`
  if (!API_URL) {
    return { pageUrl, headers: { 'List-Unsubscribe': `<${pageUrl}>` } }
  }
  return {
    pageUrl,
    headers: {
      'List-Unsubscribe': `<${API_URL}/api/newsletter/unsubscribe/${unsubToken}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
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
  const artistName = actorDisplayName(draft.user)

  // Process in batches to avoid memory pressure on large lists
  let processed = 0
  let cursor: string | undefined

  for (;;) {
    const sends = await prisma.newsletterSend.findMany({
      where: { draftId, state: 'QUEUED' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        subscriber: {
          select: { id: true, email: true, unsubToken: true, unsubscribedAt: true },
        },
      },
    })

    if (sends.length === 0) break

    for (const send of sends) {
      const { subscriber } = send
      // Someone who unsubscribed after the send was queued gets nothing, and
      // the row goes so the delivery report does not count them.
      if (subscriber.unsubscribedAt) {
        await prisma.newsletterSend.delete({ where: { id: send.id } })
        continue
      }
      const { pageUrl: unsubUrl, headers: unsubHeaders } = newsletterUnsubscribeLinks(
        subscriber.unsubToken,
      )
      const plainText = [
        draft.bodyMd,
        '',
        '─',
        `You are receiving this because you subscribed to ${artistName}.`,
        `Unsubscribe: ${unsubUrl}`,
        `Source code: ${SOURCE_REPO}`,
      ].join('\n')

      try {
        await getTransport().sendMail({
          from: `${artistName} via Tahti <${SMTP_FROM}>`,
          to: subscriber.email,
          subject: draft.subject,
          text: plainText,
          headers: {
            ...unsubHeaders,
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
