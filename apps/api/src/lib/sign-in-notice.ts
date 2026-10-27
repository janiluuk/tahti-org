// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { safeDisplayName } from '@tahti/shared'
import { auditLog } from './audit.js'
import { sendSecurityNotice } from './security-email.js'

/** Records a sign-in (the USER_LOGIN audit entry, now with its device label)
 * and emails the account when it comes from a device it never signed in
 * from before. The very first sign-in sends nothing. Never throws. */
export async function recordSignIn(
  prisma: PrismaClient,
  user: { id: string; email: string; username: string; displayName: string | null },
  deviceLabel: string | null,
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    if (deviceLabel) {
      const [earlier, sameDevice] = await Promise.all([
        prisma.auditLog.findFirst({
          where: { action: 'USER_LOGIN', actorId: user.id },
          select: { id: true },
        }),
        prisma.auditLog.findFirst({
          where: {
            action: 'USER_LOGIN',
            actorId: user.id,
            meta: { path: ['deviceLabel'], equals: deviceLabel },
          },
          select: { id: true },
        }),
      ])
      if (earlier && !sameDevice) {
        await sendSecurityNotice(
          {
            to: user.email,
            displayName: safeDisplayName(user.displayName, user.username),
            subject: 'New sign-in to your Tahti account',
            what: `Your Tahti account was just signed in to from a device it hasn't used before: ${deviceLabel}. You can sign other devices out in Settings → Account → Devices.`,
          },
          log,
        )
      }
    }
    await auditLog(prisma, {
      action: 'USER_LOGIN',
      actorId: user.id,
      meta: { username: user.username, deviceLabel },
    })
  } catch (err) {
    log.warn({ err }, 'sign-in record failed')
  }
}
