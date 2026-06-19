// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Read the newest verification token for `email` from MailHog (stack UI port 18025). */
export async function verificationTokenForEmail(email, mailhogUrl = process.env.MAILHOG_URL) {
  const base = mailhogUrl ?? 'http://localhost:18025'
  const res = await fetch(`${base}/api/v2/messages?limit=50`)
  if (!res.ok) throw new Error(`MailHog unreachable at ${base}: ${res.status}`)
  const data = await res.json()
  for (const item of data.items ?? []) {
    const toHeader = item.Content?.Headers?.To?.[0] ?? ''
    if (!toHeader.includes(email)) continue
    const body = item.Content?.Body ?? ''
    const match = body.match(/token=([A-Za-z0-9_-]+)/)
    if (match) return match[1]
  }
  throw new Error(`No verification email for ${email} in MailHog`)
}
