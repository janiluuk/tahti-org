// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

export default function ConnectionsSettingsRedirect() {
  redirect('/dashboard/settings/artist-info#social-connections')
}
