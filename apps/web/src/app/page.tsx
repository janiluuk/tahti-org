// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { BrandLogo, Heading, Link as UiLink, Stack, Text } from '@tahti/ui'
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
            <Link href="/listen" className="ui-btn ui-btn--primary ui-btn--lg">
              Listen now
            </Link>
            <Link href="/login" className="ui-btn ui-btn--secondary ui-btn--lg">
              Artist log in
            </Link>
            <Link href="/apply" className="ui-btn ui-btn--ghost ui-btn--lg">
              Apply for the beta
            </Link>
            <Link href="/login?register" className="ui-btn ui-btn--ghost ui-btn--lg">
              Create an artist account
            </Link>
          </Stack>

          <Text size="sm" tone="muted">
            Learn more at <UiLink href="https://tahti.live">tahti.live</UiLink>
          </Text>
        </div>
      </div>
    </>
  )
}
