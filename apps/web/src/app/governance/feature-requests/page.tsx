// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Legacy alias for the canonical Product feedback tab. */
export default function FeatureRequestsPage() {
  redirect('/dashboard/governance/topics')
}
