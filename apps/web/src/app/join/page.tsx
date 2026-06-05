// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Legacy /join URL — beta applications live on /apply. */
export default function JoinPage() {
  redirect('/apply')
}
