// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { BETA_SUPPORT_INBOX } from '@tahti/shared'
import { sendMail } from './email.js'

/** A security notice to the account's own address: something changed that
 * the owner should know about if it wasn't them. Never throws — the change
 * is already made. */
export async function sendSecurityNotice(
  opts: { to: string; displayName: string; subject: string; what: string },
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  const text = [
    `Hi ${opts.displayName},`,
    '',
    opts.what,
    '',
    `If this wasn't you, reset your password straight away and write to ${BETA_SUPPORT_INBOX}.`,
    '',
    '— Tahti ry',
  ].join('\n')
  try {
    await sendMail({ to: opts.to, replyTo: BETA_SUPPORT_INBOX, subject: opts.subject, text })
  } catch (err) {
    log.warn({ err }, 'security notice email failed')
  }
}
