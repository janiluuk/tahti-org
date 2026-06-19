// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import NextLink from 'next/link'
import { Heading, Link, Text } from '@tahti/ui'

export default function ForArtistsHelpPage() {
  return (
    <article className="brand-prose">
      <Text size="sm">
        <NextLink href="/dashboard">← Dashboard</NextLink>
      </Text>

      <Heading level={1}>Artist guide</Heading>
      <Text>
        Set up your channel, go live, upload sets, and share your work. Every Tahti member can
        create a 24/7 channel — broadcast up to 1 hour per week included.
      </Text>

      <Heading level={2}>1. Create your channel</Heading>
      <ol>
        <li>
          Open the dashboard → <strong>Design your artist channel</strong> (or{' '}
          <NextLink href="/dashboard/setup-channel">/dashboard/setup-channel</NextLink>).
        </li>
        <li>
          Confirm your slug — your public home will be <code>yourname.tahti.live</code> and{' '}
          <code>/c/yourname</code>.
        </li>
      </ol>

      <Heading level={2}>2. Go live</Heading>
      <ol>
        <li>
          Open the <NextLink href="/dashboard/broadcast">broadcast studio</NextLink> and copy RTMP
          or Icecast credentials.
        </li>
        <li>Start streaming in OBS, Mixxx, or Traktor.</li>
        <li>Preview audio in the studio player before sharing your channel link.</li>
      </ol>
      <Text size="sm" tone="muted">
        Step-by-step tool setup: <Link href="/help/broadcast">Broadcast setup guides</Link>
      </Text>

      <Heading level={2}>3. Upload &amp; publish</Heading>
      <ol>
        <li>
          <NextLink href="/dashboard/upload">Upload a set</NextLink> or import from Bandcamp /
          SoundCloud.
        </li>
        <li>Add title, genre, and artwork in the archive editor, then publish to your channel.</li>
        <li>
          Optional: group tracks in <NextLink href="/dashboard/collections">collections</NextLink>{' '}
          or create a <NextLink href="/dashboard#releases">smart link</NextLink> for a release.
        </li>
      </ol>

      <Heading level={2}>Your public links</Heading>
      <ul>
        <li>
          <code>/c/your-slug</code> — 24/7 channel (live + archive)
        </li>
        <li>
          <code>/u/your-username</code> — profile, releases, fan subscribe
        </li>
        <li>
          <code>/r/release-slug</code> — smart link with DSP buttons
        </li>
      </ul>

      <Heading level={2}>More help</Heading>
      <ul>
        <li>
          <Link href="/help/multistream">Multistream to YouTube / Twitch</Link>
        </li>
        <li>
          <Link href="/help/tier-limits">Free vs paid tier limits</Link>
        </li>
        <li>
          <Link href="/help/support">Contact support</Link>
        </li>
        <li>
          <NextLink href="/for-artists">Tahti for artists (overview)</NextLink>
        </li>
      </ul>
    </article>
  )
}
