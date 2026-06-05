// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import nodemailer from 'nodemailer'
import { config } from '../config.js'

let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      auth: config.email.user ? { user: config.email.user, pass: config.email.pass } : undefined,
      // In dev (mailhog), TLS is not required
      secure: config.isProd,
    })
  }
  return _transporter
}

export interface MailOptions {
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
  headers?: Record<string, string>
}

export async function sendMail(opts: MailOptions): Promise<void> {
  await getTransporter().sendMail({
    from: config.email.from,
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    headers: {
      'X-Source-Code': config.sourceRepoUrl,
      ...opts.headers,
    },
  })
}

export async function sendBetaApplicationEmail(opts: {
  name: string
  email: string
  artistType: string
  links?: string
  message?: string
  source: 'website' | 'app'
}): Promise<void> {
  const lines = [
    `New private beta application (${opts.source})`,
    '',
    `Name: ${opts.name}`,
    `Email: ${opts.email}`,
    `Artist type: ${opts.artistType}`,
  ]
  if (opts.links?.trim()) lines.push(`Links: ${opts.links.trim()}`)
  if (opts.message?.trim()) {
    lines.push('', 'Message:', opts.message.trim())
  }
  lines.push('', '— Tahti beta apply form')

  const text = lines.join('\n')
  const html = text
    .split('\n')
    .map((line) => `<p>${line.replace(/</g, '&lt;')}</p>`)
    .join('')

  await sendMail({
    to: config.email.supportInbox,
    replyTo: opts.email,
    subject: `Beta application: ${opts.name}`,
    text,
    html,
  })
}

export async function sendVerificationEmail(
  to: string,
  displayName: string,
  token: string,
): Promise<void> {
  const verifyUrl = `${config.appUrl}/verify?token=${token}`

  await getTransporter().sendMail({
    from: config.email.from,
    to,
    subject: 'Verify your Tahti email address',
    text: [
      `Hi ${displayName},`,
      '',
      'Please verify your email address by clicking the link below:',
      '',
      verifyUrl,
      '',
      'This link expires in 24 hours.',
      '',
      '— Tahti ry',
    ].join('\n'),
    html: `
      <p>Hi ${displayName},</p>
      <p>Please verify your email address:</p>
      <p><a href="${verifyUrl}">Verify email address</a></p>
      <p>This link expires in 24 hours.</p>
      <p>— Tahti ry</p>
    `,
    headers: {
      'X-Source-Code': config.sourceRepoUrl,
    },
  })
}
