// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'
import { PublicPageHeader } from '@tahti/ui'

export const metadata: Metadata = {
  title: 'About Tahti',
  description:
    'Tahti ry is a Finnish nonprofit broadcasting platform for independent artists. AGPL-licensed, member-governed, and built to put money and audience in artists hands.',
}

// Inlined via srcDoc rather than a src="/about-pitch.html" fetch — the site
// sits behind Cloudflare, which injects a blanket x-frame-options: DENY on
// every response (confirmed even on the homepage and a 404, so it's an edge
// policy, not anything this app's Caddyfile or Next config sets, and not
// something fixable from this repo). That header only applies to a framed
// document's own HTTP response; an iframe using srcDoc has no such response
// (it's rendered from the about:srcdoc pseudo-origin), so it isn't affected.
const pitchDeckHtml = readFileSync(join(process.cwd(), 'public/about-pitch.html'), 'utf8')

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
        srcDoc={pitchDeckHtml}
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
