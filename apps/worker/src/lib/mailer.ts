// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import nodemailer from 'nodemailer'
import { smtpTransportOptions } from '@tahti/shared'

export const APP_URL = (process.env.APP_URL ?? 'https://app.tahti.live').replace(/\/$/, '')

let transport: nodemailer.Transporter | null = null

/** Plain-text email from the worker (digests and recaps). */
export async function sendWorkerMail(opts: { to: string; subject: string; text: string }) {
  if (!transport) {
    transport = nodemailer.createTransport(
      smtpTransportOptions({
        host: process.env.SMTP_HOST ?? 'localhost',
        port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
      }),
    )
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? 'Tahti <noreply@tahti.live>',
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  })
}
