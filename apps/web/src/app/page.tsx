// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Tahti</h1>
      <p>A nonprofit broadcasting platform for independent artists. Your channel, always on.</p>
      <p>
        <Link href="/join">Apply for an artist account</Link>
      </p>
    </div>
  )
}
