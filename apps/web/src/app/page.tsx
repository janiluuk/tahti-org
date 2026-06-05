// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { BrandLogo, Heading, Link, Stack, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'

export default function GatewayPage() {
  return (
    <>
      <BgCanvas />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <BrandLogo href="https://tahti.live" />

          <Heading level={1}>Broadcasting for independent artists.</Heading>

          <Text tone="muted">A nonprofit platform built to support artists — not algorithms.</Text>

          <Stack gap={3} className="auth-cta-stack">
            <a href="/listen" className="ui-btn ui-btn--primary ui-btn--lg">
              Listen now
            </a>
            <a href="/login" className="ui-btn ui-btn--secondary ui-btn--lg">
              Artist log in
            </a>
            <a href="/join" className="ui-btn ui-btn--ghost ui-btn--lg">
              Apply for access
            </a>
          </Stack>

          <Text size="sm" tone="muted">
            Learn more at <Link href="https://tahti.live">tahti.live</Link>
          </Text>
        </div>
      </div>
    </>
  )
}
