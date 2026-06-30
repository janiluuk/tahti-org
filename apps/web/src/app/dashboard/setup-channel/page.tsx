// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import NextLink from 'next/link'
import { PageShell, SidebarNavIconSvg, Text } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { SetupChannelClient } from './_setup-channel-client'

const FEATURES = [
  {
    icon: 'distribution' as const,
    title: 'Broadcast studio',
    body: 'RTMP and Icecast credentials, live preview, and a weekly hour to go live on the free tier.',
  },
  {
    icon: 'upload' as const,
    title: 'Archive & releases',
    body: 'Upload sets, publish smart links, and keep your channel playing when you are offline.',
  },
  {
    icon: 'newsletter' as const,
    title: 'Audience tools',
    body: 'Fan subscriptions, newsletter, and a public page you can share anywhere.',
  },
] as const

export default async function SetupChannelPage() {
  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/setup-channel')
  if (user.channel) redirect('/dashboard/channel/edit')

  const channelHost = `${user.username}.tahti.live`

  return (
    <PageShell size="lg" className="setup-channel-page">
      <header className="setup-channel-page__hero">
        <NextLink href="/dashboard" className="setup-channel-page__back">
          ← Dashboard
        </NextLink>
        <div className="setup-channel-page__hero-icon" aria-hidden>
          <SidebarNavIconSvg name="channel" />
        </div>
        <h1 className="setup-channel-page__title">Create your artist channel</h1>
        <Text tone="muted" className="setup-channel-page__lede">
          Your 24/7 home at <strong>{channelHost}</strong>. One click provisions stream credentials
          and your public page — then customize the look in the channel editor.
        </Text>
      </header>

      <div className="setup-channel-page__features" role="list">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="setup-channel-page__feature" role="listitem">
            <span className="setup-channel-page__feature-icon" aria-hidden>
              <SidebarNavIconSvg name={feature.icon} />
            </span>
            <h2 className="setup-channel-page__feature-title">{feature.title}</h2>
            <p className="setup-channel-page__feature-body">{feature.body}</p>
          </article>
        ))}
      </div>

      <div className="setup-channel-page__cta-block">
        <SetupChannelClient slug={user.username} />
        <Text tone="muted" size="sm" className="setup-channel-page__cta-note">
          Free-tier artists get 1 hour of live time per week. Become a Tahti ry member anytime for
          unlimited live and lossless streaming.
        </Text>
      </div>
    </PageShell>
  )
}
