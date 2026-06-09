// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { BrowserFrame } from '@tahti/ui'

export const metadata: Metadata = {
  title: 'Tahti for artists — broadcast, archive, earn fairly',
  description:
    'A nonprofit broadcasting platform for independent artists. Broadcast live, build your archive, earn through fan-subs and grants. AGPL-licensed and member-governed.',
}

const FEATURES = [
  {
    icon: '📡',
    title: 'Broadcast live',
    desc: 'OBS, Mixxx, Traktor, or browser ingest. FLAC lossless for paid members, MP3 192 kbps for free — both better than most paid streaming services.',
  },
  {
    icon: '📁',
    title: 'Your archive, always on',
    desc: '24/7 channel with seamless live-to-archive transitions. Listeners tune in and keep listening even when you are offline.',
  },
  {
    icon: '💸',
    title: 'Earn through fan-subs',
    desc: 'Listeners can support you directly at €3–€10/month. 98% goes to you; 2% rolls into the grant pool for the whole community.',
  },
  {
    icon: '🏆',
    title: 'Annual artist grants',
    desc: '90% of platform surplus is distributed to artists every year based on engagement units — a fair formula, not an algorithm favouring the loudest.',
  },
  {
    icon: '🔗',
    title: 'Smart links & distribution',
    desc: 'One release smart link with DSP buttons for Spotify, Apple Music, Bandcamp, and more. Distribute via Revelator with a single form.',
  },
  {
    icon: '📧',
    title: 'Newsletter built in',
    desc: 'Send updates directly to listeners who opt in — no third-party email tool required, no per-send fees.',
  },
  {
    icon: '📊',
    title: 'Real analytics',
    desc: 'Plays, downloads, completion rates, top countries, and your running grant estimate. No listener counts as headline metrics — the constitution forbids vanity numbers.',
  },
  {
    icon: '🛡',
    title: 'Member-governed nonprofit',
    desc: 'You get a vote. The board is elected by artist members. The roadmap is public. Every euro in and out is published. No shareholders, no exit.',
  },
]

export default function ForArtistsPage() {
  return (
    <div className="brand-public brand-public--wide">
      <div className="for-artists-hero">
        <p className="for-artists-hero__eyebrow">For artists</p>
        <h1 className="for-artists-hero__title">
          Broadcast independently.
          <br />
          Get paid fairly.
        </h1>
        <p className="for-artists-hero__sub">
          Tahti is a nonprofit broadcasting platform where you keep your audience, earn through
          fan-subs and annual grants, and own your archive. AGPL-licensed and governed by its artist
          members.
        </p>
        <div className="for-artists-hero__cta-row">
          <a href="/apply" className="for-artists-cta-primary">
            Apply for access
          </a>
          <a href="/about" className="for-artists-cta-secondary">
            About the org →
          </a>
        </div>
      </div>

      <div className="for-artists-carousel">
        <div>
          <BrowserFrame url="tahti.live/c/your-channel">
            <div className="for-artists-screenshot">
              <span>Channel page — live broadcast view</span>
            </div>
          </BrowserFrame>
          <p className="for-artists-carousel-caption">Your live channel</p>
        </div>
        <div>
          <BrowserFrame url="tahti.live/dashboard">
            <div className="for-artists-screenshot">
              <span>Artist dashboard — overview</span>
            </div>
          </BrowserFrame>
          <p className="for-artists-carousel-caption">Artist dashboard</p>
        </div>
        <div>
          <BrowserFrame url="tahti.live/dashboard/stats">
            <div className="for-artists-screenshot">
              <span>Stats — plays, grants, engagement</span>
            </div>
          </BrowserFrame>
          <p className="for-artists-carousel-caption">Analytics & grant estimate</p>
        </div>
        <div>
          <BrowserFrame url="tahti.live/u/your-handle">
            <div className="for-artists-screenshot">
              <span>Public artist profile</span>
            </div>
          </BrowserFrame>
          <p className="for-artists-carousel-caption">Your public profile</p>
        </div>
      </div>

      <div className="brand-section">
        <h2 className="brand-section-heading brand-section__title">Everything you need</h2>
        <div className="for-artists-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="for-artists-feature-card">
              <div className="for-artists-feature-card__icon" aria-hidden>
                {f.icon}
              </div>
              <p className="for-artists-feature-card__title">{f.title}</p>
              <p className="for-artists-feature-card__desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="brand-section">
        <h2 className="brand-section-heading brand-section__title">What it costs</h2>
        <div className="brand-panel">
          <p>
            <strong>Free tier</strong> — MP3 192 kbps live and archive, unlimited broadcasts,
            archive hosting, smart links, newsletter, analytics, fan-subs, grant eligibility.
            Everything. Free.
          </p>
          <p>
            <strong>Paid membership (€40/year)</strong> — FLAC lossless streaming for you and your
            listeners, priority support, Stash file storage, and a vote at the AGM.
          </p>
          <p>
            There is no &quot;freemium&quot; catch. The free tier is a complete product. Paid
            membership funds the grant pool and unlocks lossless audio.
          </p>
        </div>
      </div>

      <div className="brand-cta-row" style={{ marginTop: '2rem' }}>
        <a href="/apply" className="brand-cta">
          Apply for beta access
        </a>
        <a href="/transparency" className="brand-cta-dark">
          See the financial transparency report
        </a>
      </div>
    </div>
  )
}
