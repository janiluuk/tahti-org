// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Legacy /apply URL. Send to /signup, which already shows the right thing
 * either way — the open wizard or a clear closed-beta explanation — instead
 * of silently bouncing to the homepage with no context. */
export default function ApplyPage() {
  redirect('/signup')
}
