// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { AboutArtistCtas } from './_about-artist-ctas'

export function AboutHero() {
  return (
    <header className="about-hero">
      <div>
        <div className="about-eyebrow">About tahti.live</div>
        <h1>A home for your music, and your live shows.</h1>
        <p className="about-lede">
          We built Tahti on one belief: artists should spend their time making art. So we automate
          the tedious, mechanical work drawn from two decades in streaming, and leave you free to do
          what you are actually good at.
        </p>
        <div className="about-callouts">
          <div className="about-callout">
            <div className="about-label">Release system</div>
            <div className="about-value">
              A real discography, publishing workflow, and distribution path.
            </div>
          </div>
          <div className="about-callout">
            <div className="about-label">Broadcast platform</div>
            <div className="about-value">
              A proper live stack for performers, DJs, podcasters, and collectives.
            </div>
          </div>
          <div className="about-callout">
            <div className="about-label">Quality</div>
            <div className="about-value">
              Lossless sound for listeners, without turning it into a premium paywall.
            </div>
          </div>
        </div>
        <div className="about-cta-row">
          <AboutArtistCtas />
        </div>
      </div>
      <aside className="about-hero-card">
        <div className="about-k">Time back for your art</div>
        <div className="about-v">
          We handle the busywork: metadata, numbering, delivery, platform reach, and the rest of the
          mechanical load.
        </div>
        <p>You make the music. We take care of the rest.</p>
      </aside>
    </header>
  )
}
