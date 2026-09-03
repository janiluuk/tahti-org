// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Renamed to /dashboard/sounds (Archive->Sound rename). Keep old links working. */
export default function ArchiveRedirect() {
  redirect('/dashboard/sounds')
}
