// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { PublicPageHeader } from '@tahti/ui'

export const metadata: Metadata = {
  title: 'About Tahti',
  description:
    'Tahti ry is a Finnish nonprofit broadcasting platform for independent artists. AGPL-licensed, member-governed, and built to put money and audience in artists hands.',
}

export default function AboutPage() {
  return (
    <div className="brand-public">
      <PublicPageHeader title="About Tahti">
        A nonprofit broadcasting platform owned and governed by its artist members.
      </PublicPageHeader>

      <div className="brand-prose">
        <p>
          <a href="/about-pitch.html" target="_blank" rel="noopener noreferrer">
            Open the pitch deck full-screen ↗
          </a>
        </p>
      </div>

      <iframe
        src="/about-pitch.html"
        title="Tahti pitch deck"
        style={{
          width: '100%',
          height: '80vh',
          minHeight: 560,
          border: '1px solid var(--line, #2A3352)',
          borderRadius: 16,
          marginTop: '1rem',
        }}
      />
    </div>
  )
}
