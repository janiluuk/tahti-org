// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'
import { BgCanvas } from '@/components/ui/bg-canvas'

export const metadata: Metadata = {
  title: 'Open beta — 1 August 2026 — Tahti',
  description: 'Tahti opens publicly on 1 August 2026. Private beta is now closed.',
}

export default function SignupPage() {
  return (
    <div data-tahti-ui="brand" className="brand-channel">
      <BgCanvas />
      <div className="gateway-shell">
        <div className="gateway-card">
          <Link href="/" className="gateway-logo-link">
            <span
              style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', color: '#e8eaf6' }}
            >
              TAHTI
            </span>
          </Link>
          <h1
            style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e8eaf6', margin: '24px 0 8px' }}
          >
            Private beta is closed
          </h1>
          <p style={{ color: '#8892a4', lineHeight: 1.6, margin: '0 0 24px' }}>
            We ran a private beta with a small group of artists. The platform opens publicly on{' '}
            <strong style={{ color: '#e8eaf6' }}>1 August 2026</strong>.
          </p>
          <p style={{ color: '#8892a4', lineHeight: 1.6, margin: '0 0 28px' }}>
            To be notified when registration opens, email{' '}
            <a href="mailto:hello@tahti.fi" style={{ color: '#00d4ff' }}>
              hello@tahti.fi
            </a>
            .
          </p>
          <Link
            href="/login"
            className="ui-btn ui-btn--secondary"
            style={{ display: 'inline-block' }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
