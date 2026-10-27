// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { BETA_SUPPORT_INBOX } from '@tahti/shared'

/** What a sign-in step answers for a suspended account, once the password
 * (or the second factor) was right: the board's reason and where to ask. */
export function suspendedLoginMessage(reason: string | null): string {
  const because = reason ? ` Reason: ${reason}.` : ''
  return `This account has been suspended.${because} Write to ${BETA_SUPPORT_INBOX} if you think this is a mistake.`
}
