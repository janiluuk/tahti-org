// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import NextLink from 'next/link'
import { Heading, Link, Text } from '@tahti/ui'

export default function ForListenersHelpPage() {
  return (
    <article className="brand-prose">
      <Text size="sm">
        <NextLink href="/listen">← Discover</NextLink>
      </Text>

      <Heading level={1}>Listener guide</Heading>
      <Text>
        Listening, downloading, and chatting all work without an account. Nothing below is required
        — it&apos;s here for when you want to go further.
      </Text>

      <Heading level={2}>1. Find something to listen to</Heading>
      <ol>
        <li>
          Browse <NextLink href="/listen">who&apos;s on air right now</NextLink>, or go straight to
          an artist&apos;s channel at <code>/c/their-slug</code>.
        </li>
        <li>
          When an artist is offline, their channel keeps playing their archive — you&apos;re never
          looking at a dead page.
        </li>
        <li>
          Prefer something always-on and varied? <NextLink href="/radio">Tahti Radio</NextLink> is a
          fair-rotation stream drawing from across the whole community.
        </li>
      </ol>

      <Heading level={2}>2. Support an artist directly</Heading>
      <ol>
        <li>
          Open an artist&apos;s profile at <code>/u/their-username</code> and choose{' '}
          <strong>Subscribe</strong>.
        </li>
        <li>Fan subscriptions run €3–€10/month — set by the artist, billed to you directly.</li>
        <li>98% of what you pay goes to the artist. Cancel any time from your account.</li>
      </ol>
      <Text size="sm" tone="muted">
        Where the other 2% goes and how annual grants work:{' '}
        <Link href="/how-it-works">How Tahti works</Link>
      </Text>

      <Heading level={2}>3. Download &amp; keep</Heading>
      <ol>
        <li>Free tracks and releases can be downloaded straight from the artist&apos;s page.</li>
        <li>
          Downloads are rate-limited per IP to prevent abuse — legitimate listeners don&apos;t need
          an account to download.
        </li>
      </ol>

      <Heading level={2}>4. Chat during a broadcast</Heading>
      <ol>
        <li>Chat is open on every live channel — no sign-in required to read or post.</li>
        <li>Moderators (set by the artist) can mute or remove disruptive messages.</li>
      </ol>

      <Heading level={2}>Your privacy</Heading>
      <ul>
        <li>Anonymous by default — accounts only exist where billing requires one.</li>
        <li>
          IP hashes rotate daily; we can&apos;t tell you&apos;re the same listener from yesterday.
        </li>
        <li>
          No cookies for analytics, no ads, no algorithmic &quot;recommended for you&quot; feed.
        </li>
      </ul>

      <Heading level={2}>More help</Heading>
      <ul>
        <li>
          <Link href="/how-it-works">How Tahti works — the full walkthrough</Link>
        </li>
        <li>
          <Link href="/transparency">Where the money goes</Link>
        </li>
        <li>
          <Link href="/help/support">Contact support</Link>
        </li>
        <li>
          <NextLink href="/help/for-artists">Also an artist? Read the artist guide →</NextLink>
        </li>
      </ul>
    </article>
  )
}
