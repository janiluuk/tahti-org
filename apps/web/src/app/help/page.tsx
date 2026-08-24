// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { Breadcrumb, Heading, Text } from '@tahti/ui'

export const metadata: Metadata = {
  title: 'Help center',
  description: 'Guides for broadcasting, account tiers, and getting in touch with the team.',
}

const GUIDES: { href: string; icon: string; title: string; description: string }[] = [
  {
    href: '/help/for-artists',
    icon: '🎙️',
    title: 'Artist guide',
    description: 'Create your channel, go live, upload sets, and share your public links.',
  },
  {
    href: '/help/for-listeners',
    icon: '🎧',
    title: 'Listener guide',
    description:
      'Find channels, support artists directly, download, and chat — no account required.',
  },
  {
    href: '/help/broadcast',
    icon: '📡',
    title: 'Broadcast setup guides',
    description: 'Connect OBS, Streamlabs, Mixxx, or Traktor to your Tahti stream key.',
  },
  {
    href: '/help/multistream',
    icon: '🔀',
    title: 'Multistream to YouTube / Twitch',
    description: 'Mirror your live broadcast to other platforms alongside Tahti.',
  },
  {
    href: '/help/tier-limits',
    icon: '⭐',
    title: 'Free tier vs membership',
    description: 'Live-hour limits, audio quality, and what changes when you support Tahti ry.',
  },
  {
    href: '/help/disco-widgets',
    icon: '🧩',
    title: 'Contribute a Disco-widget',
    description: 'Build a widget for the store and submit it as a pull request for review.',
  },
  {
    href: '/help/support',
    icon: '✉️',
    title: 'Contact support',
    description: 'Reach the Tahti team about your account, billing, or a technical issue.',
  },
]

export default function HelpIndexPage() {
  return (
    <div className="help-index">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Help' }]} />

      <header className="help-index__header">
        <Heading level={1}>Help center</Heading>
        <Text>Guides for broadcasting, account tiers, and getting in touch with the team.</Text>
      </header>

      <div className="help-index__grid">
        {GUIDES.map((guide) => (
          <a key={guide.href} href={guide.href} className="help-index__card">
            <span className="help-index__card-icon" aria-hidden>
              {guide.icon}
            </span>
            <div>
              <div className="help-index__card-title">{guide.title}</div>
              <p className="help-index__card-description">{guide.description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
