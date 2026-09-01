// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Compatibility entry point. Member governance now lives under the dashboard
 * navigation so members and board users have one canonical experience. */
export default function GovernancePage() {
  redirect('/dashboard/governance')
}
