// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import NextLink from 'next/link'
import { PageShell } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { StepGenres } from './_step-genres'
import { StepGoLive } from './_step-go-live'
import { StepIdentity } from './_step-identity'
import { StepLook } from './_step-look'
import { StepRotation } from './_step-rotation'
import { loadRotationState, loadWizardProfile } from './_wizard-data'
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
  const profile = await loadWizardProfile()
  const reachable = hasChannel ? 5 : 1
  const rotation = step === 4 ? await loadRotationState() : { trackCount: 0, fallbackEnabled: true }

  return (
    <PageShell size="lg" className="setup-channel-page">
      <NextLink href="/dashboard" className="setup-channel-page__back">
        ← Dashboard
      </NextLink>
      {step === 1 && (
        <WizardShell
          current={1}
          reachable={reachable}
          title="Time to set up your station"
          lede={`Your 24/7 home at ${user.username}.tahti.live. Start with a name, a logo and a short description.`}
        >
          <StepIdentity
            hasChannel={hasChannel}
            initialName={user.displayName}
            initialDescription={profile.bio}
          />
        </WizardShell>
      )}
      {step === 2 && (
        <WizardShell
          current={2}
          reachable={reachable}
          title="What do you play?"
          lede="Pick the genres that describe your station and choose whether it appears in public listings."
        >
          <StepGenres initialGenres={profile.genres} initialListed={!profile.topListsOptOut} />
        </WizardShell>
      )}
      {step === 3 && (
        <WizardShell
          current={3}
          reachable={reachable}
          title="Make it yours"
          lede="Your channel page, styled the way you want it."
        >
          <StepLook />
        </WizardShell>
      )}
      {step === 4 && (
        <WizardShell
          current={4}
          reachable={reachable}
          title="Keep the music going"
          lede="24/7 rotation plays your tracks whenever you are not broadcasting live."
        >
          <StepRotation
            trackCount={rotation.trackCount}
            initialEnabled={rotation.fallbackEnabled}
          />
        </WizardShell>
      )}
      {step === 5 && (
        <WizardShell
          current={5}
          reachable={reachable}
          title="You are all set"
          lede="Your station is ready. Go live whenever you like."
        >
          <StepGoLive channelHost={`${user.username}.tahti.live`} />
        </WizardShell>
      )}
    </PageShell>
  )
}
