// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { BgCanvas, Link, Stack, Text } from '@/components/ui'

export default function GatewayPage() {
  return (
    <>
      <BgCanvas />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <Link href="https://tahti.live" className="brand-logo">
            <span className="brand-logo-bar" aria-hidden />
            TAHTI
          </Link>

          <p
            style={{
              fontFamily: 'var(--tahti-font-display)',
              fontSize: 'var(--tahti-text-3xl)',
              fontWeight: 700,
              lineHeight: 1.2,
              color: '#e8eaf6',
              margin: '0 0 0.75rem',
            }}
          >
            Broadcasting for independent artists.
          </p>

          <Text tone="muted" style={{ marginBottom: '2rem' }}>
            A nonprofit platform built to support artists — not algorithms.
          </Text>

          <Stack gap={3}>
            <a href="/listen" className="ui-btn ui-btn--primary ui-btn--lg" style={{ width: '100%', justifyContent: 'center' }}>
              Listen now
            </a>
            <a href="/login" className="ui-btn ui-btn--secondary ui-btn--lg" style={{ width: '100%', justifyContent: 'center' }}>
              Artist log in
            </a>
            <a href="/join" className="ui-btn ui-btn--ghost ui-btn--lg" style={{ width: '100%', justifyContent: 'center' }}>
              Apply for access
            </a>
          </Stack>

          <Text size="sm" tone="muted" style={{ marginTop: '2rem' }}>
            Learn more at <Link href="https://tahti.live">tahti.live</Link>
          </Text>
        </div>
      </div>
    </>
  )
}
