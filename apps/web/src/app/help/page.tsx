// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Heading, Link, Text } from '@tahti/ui'

const GUIDES: { href: string; title: string; description: string }[] = [
  {
    href: '/help/for-artists',
    title: 'Artist guide',
    description: 'Create your channel, go live, upload sets, and share your public links.',
  },
  {
    href: '/help/broadcast',
    title: 'Broadcast setup guides',
    description: 'Connect OBS, Streamlabs, Mixxx, or Traktor to your Tahti stream key.',
  },
  {
    href: '/help/multistream',
    title: 'Multistream to YouTube / Twitch',
    description: 'Mirror your live broadcast to other platforms alongside Tahti.',
  },
  {
    href: '/help/tier-limits',
    title: 'Free tier vs membership',
    description: 'Live-hour limits, audio quality, and what changes when you support Tahti ry.',
  },
  {
    href: '/help/support',
    title: 'Contact support',
    description: 'Reach the Tahti team about your account, billing, or a technical issue.',
  },
]

export default function HelpIndexPage() {
  return (
    <article className="brand-prose">
      <Heading level={1}>Help center</Heading>
      <Text>Guides for broadcasting, account tiers, and getting in touch with the team.</Text>

      <ul>
        {GUIDES.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href}>{guide.title}</Link> — {guide.description}
          </li>
        ))}
      </ul>
    </article>
  )
}
