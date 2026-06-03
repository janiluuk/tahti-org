// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { PublicBrandShell } from '@/components/public-brand-shell'

/** Dev/minimal Next home — marketing site is the separate `website` container on :8090. */
export default function HomePage() {
  return (
    <PublicBrandShell center>
      <h1>Tahti</h1>
      <p className="brand-muted">
        A nonprofit broadcasting platform for independent artists. Your channel, always on.
      </p>
      <p>
        <Link href="/join" className="brand-cta">
          Apply for an artist account
        </Link>
      </p>
      <p className="brand-muted" style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>
        <Link href="/login">Log in</Link>
        {' · '}
        <Link href="/transparency">Transparency</Link>
      </p>
    </PublicBrandShell>
  )
}
