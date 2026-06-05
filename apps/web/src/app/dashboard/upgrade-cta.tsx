// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

export default function UpgradeCta({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <div className="studio-upgrade-cta">
      <p>
        Your listeners heard MP3 192 on your last show. Upgrade to broadcast in lossless FLAC and
        remove the weekly hour cap — €40/year, tax-deductible for registered professionals in
        Finland.
      </p>
      <Link href="/dashboard#membership" className="studio-link-cta">
        View membership →
      </Link>
    </div>
  )
}
