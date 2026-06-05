// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Legacy /join URL — registration lives on the login page. */
export default function JoinPage() {
  redirect('/login?register')
}
