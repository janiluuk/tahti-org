// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { Panel, Text } from '@/components/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { SetupChannelClient } from './_setup-channel-client'

export default async function SetupChannelPage() {
  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/setup-channel')
  if (user.channel) redirect('/dashboard')

  return (
    <div className="db-overview">
      <Panel title="Design your artist channel">
        <Text size="sm" tone="muted">
          Every Tahti member gets a 24/7 channel at <strong>{user.username}.tahti.live</strong> for
          broadcasting live, archiving past sets, and growing fan subscriptions. Create it now to
          unlock the broadcast studio, archive uploads, and stream credentials.
        </Text>
        <div className="studio-mt-lg">
          <SetupChannelClient slug={user.username} />
        </div>
      </Panel>
    </div>
  )
}
