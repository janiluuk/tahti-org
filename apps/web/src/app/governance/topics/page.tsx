// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Keep old bookmarked topic URLs working without maintaining a second page. */
export default function GovernanceTopicsPage() {
  redirect('/dashboard/governance/topics')
}
