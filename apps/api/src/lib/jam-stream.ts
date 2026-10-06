// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { JamEvent } from '@tahti/shared'

/** True when `event` is the last thing this listener should be sent: the jam
 * ended, or the listener is no longer one of its participants (they left or
 * the host removed them). */
export function isLastJamEventFor(event: JamEvent, userId: string): boolean {
  if (event.type === 'ended') return true
  return !event.session.participants.some((p) => p.userId === userId)
}
