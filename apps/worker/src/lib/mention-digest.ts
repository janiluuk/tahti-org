// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { MentionSurface, PrismaClient } from '@tahti/db'
import nodemailer from 'nodemailer'
import { smtpTransportOptions } from '@tahti/shared'

const SMTP_HOST = process.env.SMTP_HOST ?? 'localhost'
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '1025', 10)
const SMTP_USER = process.env.SMTP_USER ?? ''
const SMTP_PASS = process.env.SMTP_PASS ?? ''
const SMTP_FROM = process.env.SMTP_FROM ?? 'Tahti <noreply@tahti.live>'
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

const SURFACE_LABEL: Record<MentionSurface, string> = {
  BIO: 'their profile bio',
  ANNOUNCEMENT: 'a channel announcement',
  RELEASE: 'release credits',
  NEWSLETTER: 'a newsletter draft',
  TRACKLIST: 'a tracklist',
}

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

async function sendMentionDigest(opts: {
  to: string
  displayName: string
  lines: string[]
}): Promise<void> {
  const count = opts.lines.length
  const subject =
    count === 1 ? 'You were mentioned on Tahti' : `You were mentioned ${count} times on Tahti today`
  const text = [
    `Hi ${opts.displayName},`,
    '',
    count === 1
      ? 'Another artist mentioned you on Tahti:'
      : `Other artists mentioned you ${count} times today:`,
    '',
    ...opts.lines.map((line) => `• ${line}`),
    '',
    `View your profile: ${APP_URL}/dashboard`,
    '',
    '— Tahti',
  ].join('\n')
  const html = text.replace(/\n/g, '<br>\n')

  await getTransport().sendMail({
    from: SMTP_FROM,
    to: opts.to,
    subject,
    text,
    html,
  })
}

export async function processMentionDigests(prisma: PrismaClient) {
  const pending = await prisma.mention.findMany({
    where: { notifiedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      surface: true,
      targetUserId: true,
      mentioner: { select: { username: true, displayName: true } },
      target: {
        select: {
          email: true,
          displayName: true,
          mentionsEnabled: true,
          emailVerifiedAt: true,
        },
      },
    },
  })

  const byTarget = new Map<
    string,
    {
      email: string
      displayName: string
      mentionIds: string[]
      lines: string[]
    }
  >()

  for (const row of pending) {
    if (!row.target.mentionsEnabled || !row.target.emailVerifiedAt) {
      await prisma.mention.update({
        where: { id: row.id },
        data: { notifiedAt: new Date() },
      })
      continue
    }

    const surfaceLabel = SURFACE_LABEL[row.surface] ?? row.surface.toLowerCase()
    const line = `@${row.mentioner.username} (${row.mentioner.displayName}) in ${surfaceLabel}`

    const existing = byTarget.get(row.targetUserId)
    if (existing) {
      existing.mentionIds.push(row.id)
      existing.lines.push(line)
    } else {
      byTarget.set(row.targetUserId, {
        email: row.target.email,
        displayName: row.target.displayName,
        mentionIds: [row.id],
        lines: [line],
      })
    }
  }

  let digestsSent = 0
  let mentionsMarked = 0

  for (const [, group] of byTarget) {
    try {
      await sendMentionDigest({
        to: group.email,
        displayName: group.displayName,
        lines: group.lines,
      })
      digestsSent++
    } catch (err) {
      console.error(`[mention-digest] failed to send to ${group.email}:`, err)
      continue
    }

    const now = new Date()
    await prisma.mention.updateMany({
      where: { id: { in: group.mentionIds } },
      data: { notifiedAt: now },
    })
    mentionsMarked += group.mentionIds.length
  }

  return { digestsSent, mentionsMarked, pending: pending.length }
}
