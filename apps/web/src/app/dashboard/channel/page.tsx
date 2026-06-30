// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Channel design moved to /dashboard/channel/edit (ux-overhaul.md §3). Keep old links working. */
export default function ChannelDesignRedirect() {
  redirect('/dashboard/channel/edit')
}
