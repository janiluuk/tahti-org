// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Folded into the main Stats page as its "Plays & listeners" tab, sharing
 * that page's single 7d/30d/All range control instead of running its own
 * separate one — kept as a redirect for anyone with this URL bookmarked. */
export default function StatsDetailPage() {
  redirect('/dashboard/stats?tab=plays')
}
