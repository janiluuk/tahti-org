// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Nodemailer transport options that match the SMTP port (not NODE_ENV). */
export function smtpTransportOptions(opts: {
  host: string
  port: number
  user?: string
  pass?: string
}): {
  host: string
  port: number
  secure: boolean
  requireTLS: boolean
  auth?: { user: string; pass: string }
} {
  const secureOverride = process.env.SMTP_SECURE?.trim().toLowerCase()
  const secure =
    secureOverride === 'true' ? true : secureOverride === 'false' ? false : opts.port === 465
  const requireTLS =
    secureOverride === 'false' ? false : !secure && (opts.port === 587 || opts.port === 2525)

  return {
    host: opts.host,
    port: opts.port,
    secure,
    requireTLS,
    auth: opts.user ? { user: opts.user, pass: opts.pass ?? '' } : undefined,
  }
}
