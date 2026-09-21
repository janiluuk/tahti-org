// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import NextLink from 'next/link'
import { Stack, Text } from '@tahti/ui'

/** Final step: the station exists — point at the public page and the broadcast studio. */
export function StepGoLive({ channelHost }: { channelHost: string }) {
  return (
    <Stack gap={4}>
      <Text tone="muted">
        Your public page is live at <strong>{channelHost}</strong>. When you are ready to broadcast,
        the studio has your RTMP and Icecast credentials and a live preview. Free-tier artists get 1
        hour of live time per week.
      </Text>
      <NextLink href="/dashboard/broadcast" className="db-quick-action db-quick-action--primary">
        Open the broadcast studio
      </NextLink>
      <NextLink href={`https://${channelHost}`} className="db-quick-action">
        View my channel
      </NextLink>
      <NextLink href="/dashboard" className="db-quick-action">
        Finish — go to dashboard
      </NextLink>
    </Stack>
  )
}
