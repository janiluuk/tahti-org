// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import Link from 'next/link'

export default function UpgradeCta({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1rem 1.25rem',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#f8fafc',
      }}
    >
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', lineHeight: 1.5, color: '#374151' }}>
        Your listeners heard MP3 192 on your last show. Upgrade to broadcast in lossless FLAC and
        remove the weekly hour cap — €40/year, tax-deductible for registered professionals in
        Finland.
      </p>
      <Link
        href="/dashboard#membership"
        style={{
          display: 'inline-block',
          fontSize: '0.875rem',
          color: '#2563eb',
          fontWeight: 500,
        }}
      >
        View membership →
      </Link>
    </div>
  )
}
