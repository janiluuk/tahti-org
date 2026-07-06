// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { PublicPageHeader } from '@tahti/ui'

export const metadata: Metadata = {
  title: 'How Tahti works — for listeners and artists',
  description:
    'A walkthrough of how Tahti actually works: how listeners find and support artists, how artists broadcast and get paid, and exactly where the money goes — published the same way our financial ledger is.',
}

export default function HowItWorksPage() {
  return (
    <div className="brand-public">
      <PublicPageHeader title="How Tahti works">
        Not a features list — a walkthrough. What actually happens when you listen, and what
        actually happens when you broadcast. Every number below is the same number published on the{' '}
        <a href="/transparency">transparency page</a>.
      </PublicPageHeader>

      <div className="brand-prose">
        <h2>For listeners</h2>
        <p>
          You don&apos;t need an account to listen. You never will — that&apos;s constitutional, not
          a growth-hack limit that gets tightened later.
        </p>
        <ol>
          <li>
            <strong>Find a channel.</strong> Browse <a href="/listen">who&apos;s on air</a>, tune
            into an artist&apos;s 24/7 channel (live blends straight into their archive when
            they&apos;re offline), or listen to <a href="/radio">Tahti Radio</a>, a fair-rotation
            meta-stream of the whole community. No algorithm decides what you hear next — there is
            no &quot;recommended for you&quot; on Tahti, by design.
          </li>
          <li>
            <strong>Hear it in full quality, free.</strong> Every listener gets FLAC 16/44 lossless
            audio on a member artist&apos;s channel, whether or not you or the artist pay for
            anything. Most platforms cap free listeners at 128 kbps or lower. Tahti doesn&apos;t
            gate audio quality at the listener tier — that&apos;s constitutional too.
          </li>
          <li>
            <strong>Support an artist directly, if you want to.</strong> Fan subscriptions run
            €3–€10/month, straight from you to them. See{' '}
            <a href="/help/for-listeners">the listener guide</a> for how to subscribe, download, and
            chat.
          </li>
          <li>
            <strong>Stay anonymous.</strong> Listening, downloading, and chatting all work without
            an account. Where an account exists (subscribing costs money, so billing needs one), IP
            hashes rotate daily — we cannot tell that the same listener came back yesterday. No
            tracking beyond what the product strictly needs to run, no cookies for analytics, no
            ads, ever.
          </li>
        </ol>

        <h2>For artists</h2>
        <p>
          The free tier is a complete product, not a trial. Everything below works whether or not
          you ever pay Tahti a cent.
        </p>
        <ol>
          <li>
            <strong>Create your channel.</strong> Your own <code>handle.tahti.live</code> and{' '}
            <code>/c/your-slug</code> — set up in minutes from the dashboard. See{' '}
            <a href="/help/for-artists">the artist guide</a> for the exact steps.
          </li>
          <li>
            <strong>Broadcast, and keep an archive that never goes dark.</strong> Go live from OBS,
            Mixxx, Traktor, or straight from the browser. When you&apos;re offline, your channel
            plays your archive on a seamless loop — listeners never hit a dead page. Free tier
            broadcasts at MP3 192 kbps; members and their listeners get FLAC lossless.
          </li>
          <li>
            <strong>Get paid two ways.</strong> Fan subscriptions keep 98% for you — the 2%
            operational fee covers Stripe and support, and any surplus it generates rolls into next
            year&apos;s grant pool rather than becoming Tahti&apos;s profit. Separately, 90% of the
            platform&apos;s entire annual operating surplus is distributed to artists as grants,
            split by <em>engagement units</em> — downloads and fan-sub euros, not passive plays — so
            an artist whose audience actually cares gets more than one who just racks up
            listener-hours.
          </li>
          <li>
            <strong>Distribute everywhere else too.</strong> A smart link with DSP buttons for
            Spotify, Apple Music, Bandcamp, and more. One-form delivery to Spotify/Apple/Tidal via
            Revelator, plus direct Mixcloud publishing.
          </li>
          <li>
            <strong>Get a real vote, not a feedback form.</strong> Every artist member votes at the
            AGM. The board is elected from the membership. The roadmap is public, and it changes
            based on what members actually approve — not founder discretion.
          </li>
        </ol>

        <h2>The money, transparently</h2>
        <p>
          This isn&apos;t a marketing summary of the numbers — it&apos;s the same rule the board
          operates under, published in the org&apos;s own constitution:
        </p>
        <ul>
          <li>Fan-subscriptions: 98% to the artist, 2% operational fee, 0% Tahti profit.</li>
          <li>
            Annual surplus: 90% distributed to artists as grants, 10% held in an operating reserve
            capped at 6 months of costs — anything above that cap goes back to artists too.
          </li>
          <li>
            No venture capital, no equity, no exit. Tahti ry is a Finnish nonprofit association
            (yhdistys) — it legally cannot become a for-profit company without dissolving the
            membership.
          </li>
          <li>
            Every euro in and out is published, monthly, in an append-only ledger — not a
            once-a-year PDF.
          </li>
        </ul>
        <p>
          Read the full, current numbers on the <a href="/transparency">transparency dashboard</a>,
          or the exact grant formula and accounting methodology on the{' '}
          <a href="/transparency/methodology">methodology page</a>.
        </p>
      </div>

      <div className="brand-cta-row" style={{ marginTop: '2rem' }}>
        <a href="/listen" className="brand-cta">
          Listen now
        </a>
        <a href="/login" className="brand-cta">
          Start broadcasting
        </a>
        <a href="/transparency" className="brand-cta-dark">
          See the transparency report
        </a>
      </div>
    </div>
  )
}
