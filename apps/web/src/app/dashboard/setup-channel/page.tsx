// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import NextLink from 'next/link'
import { PageShell } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { StepIdentity } from './_step-identity'
import { WizardShell } from './_wizard-shell'
import { resolveWizardStep } from './_wizard-steps'

export default async function SetupChannelPage({
  searchParams,
}: {
  searchParams: { step?: string }
}) {
  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/setup-channel')
  // A finished channel with no explicit step goes straight to the editor, as before.
  if (user.channel && !searchParams.step) redirect('/dashboard/channel/edit')

  const hasChannel = Boolean(user.channel)
  const step = resolveWizardStep(searchParams.step, hasChannel)
  // Steps 2–5 land in follow-up commits; until then continue in the full editor.
  if (step > 1) redirect('/dashboard/channel/edit')

  return (
    <PageShell size="lg" className="setup-channel-page">
      <NextLink href="/dashboard" className="setup-channel-page__back">
        ← Dashboard
      </NextLink>
      <WizardShell
        current={step}
        reachable={hasChannel ? 5 : 1}
        title="Time to set up your station"
        lede={`Your 24/7 home at ${user.username}.tahti.live. Start with a name, a logo and a short description.`}
      >
        <StepIdentity
          hasChannel={hasChannel}
          initialName={user.displayName}
          initialDescription=""
        />
      </WizardShell>
    </PageShell>
  )
}
