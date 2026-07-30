// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Members live under Artist info now — keep this URL working for old bookmarks. */
export default function MembersSettingsPage() {
  redirect('/dashboard/settings/artist-info#members')
}
