// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Canonical public venue profile is `/v/:slug` — keep `/venues/:slug` as an alias. */
export default function VenueSlugAliasPage({ params }: { params: { slug: string } }) {
  redirect(`/v/${encodeURIComponent(params.slug)}`)
}
