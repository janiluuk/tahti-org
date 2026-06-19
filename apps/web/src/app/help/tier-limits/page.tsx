// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Heading, Link, Text } from '@tahti/ui'

export default function TierLimitsHelpPage() {
  return (
    <article className="brand-prose">
      <Text size="sm">
        <Link href="/dashboard">← Dashboard</Link>
      </Text>

      <Heading level={1}>Free-tier artists vs members</Heading>
      <Text>
        Every account is an artist account. You can broadcast and publish on the{' '}
        <strong>free tier</strong> at no cost, or become a <strong>Tahti ry member</strong> by
        financially supporting the cooperative (€40/year). Membership is not a “customer plan” — it
        is how you support the org and unlock lossless streaming plus unlimited live time. Your
        status is shown on the dashboard and in <Link href="/dashboard#membership">membership</Link>
        .
      </Text>

      <Heading level={2}>Free-tier artist</Heading>
      <ul>
        <li>
          <strong>1 hour of live broadcasting per week</strong> (resets Monday 00:00 UTC)
        </li>
        <li>
          Warnings at <strong>45</strong> and <strong>55 minutes</strong> used
        </li>
        <li>
          A <strong>60-second grace period</strong> after the hour ends so you can finish the
          current track
        </li>
        <li>
          Listeners hear <strong>MP3 192 kbps</strong> HLS (<code>stream-mp3-192</code>)
        </li>
        <li>Archive fallback plays when you are offline</li>
      </ul>

      <Heading level={2}>Tahti ry member (€40/year)</Heading>
      <ul>
        <li>
          <strong>Unlimited live</strong> — no weekly hour cap
        </li>
        <li>
          Listeners hear <strong>lossless FLAC</strong> HLS (<code>stream-flac</code>)
        </li>
        <li>Broadcast archives can be stored in FLAC for members</li>
        <li>
          Financial support for the cooperative — tax-deductible for registered professionals in
          Finland
        </li>
        <li>One vote at the AGM and full governance participation</li>
      </ul>

      <Heading level={2}>What listeners see</Heading>
      <Text>
        Stream quality follows <strong>your</strong> membership status, not the listener&apos;s
        account. A free-tier artist&apos;s channel always serves MP3; a member&apos;s channel serves
        FLAC when live.
      </Text>

      <Heading level={2}>When you hit the weekly cap</Heading>
      <ol>
        <li>Dashboard shows a progress bar and warning copy</li>
        <li>At 60:00 you enter a short grace period while the show winds down</li>
        <li>After grace, new RTMP/Icecast connections are rejected until Monday</li>
        <li>Your archive playlist keeps playing for listeners until you go live again</li>
      </ol>

      <Text size="sm" tone="muted">
        Setup guides: <Link href="/help/broadcast">OBS, Mixxx &amp; Traktor</Link>
      </Text>
    </article>
  )
}
