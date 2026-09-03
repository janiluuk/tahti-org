// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Renamed to /admin/channels/[slug]/sounds (Archive->Sound rename). Keep old links working. */
export default function AdminArchiveRedirect({ params }: { params: { slug: string } }) {
  redirect(`/admin/channels/${params.slug}/sounds`)
}
