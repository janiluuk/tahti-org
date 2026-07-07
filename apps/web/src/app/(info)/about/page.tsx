// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { PublicPageHeader } from '@tahti/ui'

export const metadata: Metadata = {
  title: 'About Tahti',
  description:
    'Tahti ry is a Finnish nonprofit broadcasting platform for independent artists. AGPL-licensed, member-governed, and built to put money and audience in artists hands.',
}

export default function AboutPage() {
  return (
    <div className="brand-public">
      <PublicPageHeader title="About Tahti">
        A nonprofit broadcasting platform owned and governed by its artist members.
      </PublicPageHeader>

      <div className="brand-prose">
        <h2>Our mission</h2>
        <p>
          Tahti ry (Tahti association) is a Finnish nonprofit association (yhdistys) founded to put
          money, audience, and infrastructure in the hands of independent musicians — with no
          shareholders, no advertising, and no exit.
        </p>
        <p>
          The platform exists for one purpose: to be the best broadcasting platform for independent
          artists. Quality is a constitutional obligation, not an aspiration.
        </p>

        <h2>How the money works</h2>
        <p>
          Artists pay a membership subscription (€40/year or free tier). 90% of operating surplus is
          distributed annually to artists as grants based on engagement units — a fair formula
          combining plays, downloads, and direct fan support. The remaining 10% builds a reserve
          (capped at 6 months of costs). Surplus above the cap goes back to artists.
        </p>
        <p>
          Fan subscriptions (€1–€100/month, set by the artist) go directly to the artist, minus a 2%
          platform fee that rolls into the next grant pool. Tahti takes no cut of fan-sub revenue
          for itself.
        </p>
        <p>
          The full financial picture — every euro in and out — is published on the{' '}
          <a href="/transparency">transparency page</a>.
        </p>

        <h2>Member governance</h2>
        <p>
          Every artist member has a vote. The board is elected by the membership. From Year 4, a
          majority of board seats are reserved for elected artist representatives. The director is a
          hired role with a published description and a succession plan — not a founder who runs it
          forever.
        </p>
        <p>
          Member proposals are accepted year-round and addressed at the annual general meeting
          (AGM). The roadmap is public and members vote on priority. Board minutes are published.
          Director compensation is published.
        </p>
        <p>
          Active members can read motions and cast votes on the{' '}
          <a href="/governance">governance page</a>.
        </p>

        <h2>Open source and AGPL</h2>
        <p>
          The entire Tahti platform is published under the{' '}
          <a href="https://www.gnu.org/licenses/agpl-3.0.en.html">AGPL-3.0 licence</a>. This means:
        </p>
        <ul>
          <li>You can read the source code.</li>
          <li>You can run your own instance for your community.</li>
          <li>
            If you run a fork as a service over a network, you must share your modified source.
          </li>
          <li>
            Forks are explicitly encouraged. We document the fork path at <a href="/agpl">/agpl</a>.
          </li>
        </ul>
        <p>
          Your content is not affected by our licence. Artists retain full copyright over everything
          they upload and broadcast.
        </p>

        <h2>What we do not do</h2>
        <ul>
          <li>Advertising of any kind in the listener-facing product.</li>
          <li>Selling user, listener, or aggregated analytics data to third parties.</li>
          <li>
            Algorithmic recommendation rails (&quot;trending&quot;, &quot;recommended for
            you&quot;).
          </li>
          <li>
            Venture capital, equity investment, or any funding that requires future financial
            returns to a funder.
          </li>
          <li>
            Listener counts as headline artist metrics — the constitution prohibits vanity numbers
            in prominent positions.
          </li>
        </ul>

        <h2>Contact</h2>
        <p>
          General enquiries: <a href="mailto:info@tahti.live">info@tahti.live</a>
          <br />
          Press: <a href="mailto:press@tahti.live">press@tahti.live</a>
          <br />
          Technical: <a href="mailto:tech@tahti.live">tech@tahti.live</a>
        </p>
      </div>
    </div>
  )
}
