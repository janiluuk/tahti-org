// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import nodemailer from 'nodemailer'
import { smtpTransportOptions } from '@tahti/shared'

const SMTP_HOST = process.env.SMTP_HOST ?? 'localhost'
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '1025', 10)
const SMTP_USER = process.env.SMTP_USER ?? ''
const SMTP_PASS = process.env.SMTP_PASS ?? ''
const SMTP_FROM = process.env.SMTP_FROM ?? 'Tahti <noreply@tahti.live>'
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

const MEMBERSHIP_TERM_MS = 365 * 24 * 60 * 60 * 1000
const RENEWAL_REMINDER_BEFORE_MS = 30 * 24 * 60 * 60 * 1000

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

async function sendMembershipMail(opts: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<void> {
  await getTransport().sendMail({
    from: SMTP_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  })
}

export async function processMembershipLapse(prisma: PrismaClient) {
  const cutoff = new Date(Date.now() - MEMBERSHIP_TERM_MS)
  const expired = await prisma.user.findMany({
    where: {
      isMember: true,
      memberSince: { lt: cutoff },
      tier: 'ARTIST',
    },
    select: { id: true },
  })

  let lapsed = 0
  for (const user of expired) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { isMember: false, tier: 'FREE' },
      }),
      prisma.membership.updateMany({
        where: { userId: user.id },
        data: { status: 'SUSPENDED' },
      }),
      prisma.auditLog.create({
        data: {
          action: 'MEMBERSHIP_LAPSED',
          actorId: 'system',
          targetId: user.id,
        },
      }),
    ])
    lapsed++
  }

  return { lapsed }
}

export async function processMembershipRenewalReminders(prisma: PrismaClient) {
  const now = Date.now()
  const windowMs = 7 * 24 * 60 * 60 * 1000
  const remindMinMs = RENEWAL_REMINDER_BEFORE_MS - windowMs / 2
  const remindMaxMs = RENEWAL_REMINDER_BEFORE_MS + windowMs / 2

  const candidates = await prisma.user.findMany({
    where: {
      isMember: true,
      memberSince: { not: null },
      emailVerifiedAt: { not: null },
    },
    select: { id: true, email: true, displayName: true, memberSince: true },
  })

  let sent = 0
  let skipped = 0

  for (const user of candidates) {
    if (!user.memberSince) continue
    const expiresAt = user.memberSince.getTime() + MEMBERSHIP_TERM_MS
    const msUntilExpiry = expiresAt - now
    if (msUntilExpiry < remindMinMs || msUntilExpiry > remindMaxMs) continue

    const already = await prisma.auditLog.findFirst({
      where: {
        action: 'MEMBERSHIP_RENEWAL_REMINDER',
        targetId: user.id,
        createdAt: { gte: new Date(now - 45 * 24 * 60 * 60 * 1000) },
      },
    })
    if (already) {
      skipped++
      continue
    }

    const renewUrl = `${APP_URL}/dashboard`
    const expiresLabel = new Date(expiresAt).toISOString().slice(0, 10)

    await sendMembershipMail({
      to: user.email,
      subject: 'Your Tahti membership renews soon',
      text: [
        `Hi ${user.displayName},`,
        '',
        `Your Tahti ry annual membership is due for renewal around ${expiresLabel}.`,
        `Visit your dashboard to renew and keep lossless broadcasting and member benefits:`,
        renewUrl,
        '',
        '— Tahti ry',
      ].join('\n'),
      html: `
        <p>Hi ${user.displayName},</p>
        <p>Your Tahti ry annual membership is due for renewal around <strong>${expiresLabel}</strong>.</p>
        <p><a href="${renewUrl}">Renew from your dashboard</a> to keep lossless broadcasting and member benefits.</p>
        <p>— Tahti ry</p>
      `,
    })

    await prisma.auditLog.create({
      data: {
        action: 'MEMBERSHIP_RENEWAL_REMINDER',
        actorId: 'system',
        targetId: user.id,
        meta: { expiresAt: new Date(expiresAt).toISOString() },
      },
    })
    sent++
  }

  return { sent, skipped }
}
