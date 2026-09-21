// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import NextLink from 'next/link'
import { Stack, Text } from '@tahti/ui'
import { wizardStepHref } from './_wizard-steps'

export const SETUP_RETURN_PARAM = 'from=setup'

/** Step 3 reuses the full channel editor rather than duplicating it; the editor shows a way back. */
export function StepLook() {
  return (
    <Stack gap={4}>
      <Text tone="muted">
        The channel editor covers your nameplate, banner, colors and live preview. Open it, make it
        yours, then come back for the last two steps.
      </Text>
      <NextLink
        href={`/dashboard/channel/edit?${SETUP_RETURN_PARAM}`}
        className="db-quick-action db-quick-action--primary"
      >
        Open the channel editor
      </NextLink>
      <NextLink href={wizardStepHref(4)} className="db-quick-action">
        Skip for now →
      </NextLink>
    </Stack>
  )
}
