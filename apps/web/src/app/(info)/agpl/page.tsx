// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { PublicPageHeader } from '@tahti/ui'

export const metadata: Metadata = {
  title: 'Source code & AGPL licence — Tahti',
  description:
    'Tahti is AGPL-3.0 licensed. Read the source, run your own instance, or fork it for your community.',
}

export default function AgplPage() {
  return (
    <div className="brand-public">
      <PublicPageHeader title="Source code & AGPL licence">
        Tahti is fully open source under the GNU Affero General Public Licence v3.
      </PublicPageHeader>

      <div className="brand-prose">
        <h2>Read the source</h2>
        <p>
          Every line of code that runs this platform is publicly available. The repository includes
          the API, the web application, the streaming infrastructure, the worker services, and the
          governance tooling.
        </p>
        <p>
          <a href="https://github.com/tahti-live/tahti-org" rel="noopener noreferrer">
            github.com/tahti-live/tahti-org →
          </a>
        </p>

        <h2>What AGPL-3.0 means</h2>
        <p>
          The <a href="https://www.gnu.org/licenses/agpl-3.0.en.html">AGPL-3.0 licence</a> is a
          strong copyleft licence. In short:
        </p>
        <ul>
          <li>You can use, study, and modify the code freely.</li>
          <li>
            If you distribute the software (as a binary or as a service), you must make the complete
            source available to users of that service.
          </li>
          <li>Modifications must be released under the same AGPL-3.0 licence.</li>
          <li>
            The &quot;network use&quot; clause (section 13) means that running a Tahti fork as a web
            service for others constitutes distribution — you cannot keep modifications private.
          </li>
        </ul>
        <p>
          Your content is <strong>not</strong> affected by this licence. Anything you upload or
          broadcast belongs to you. AGPL governs the software, not your music or recordings.
        </p>

        <h2>You can fork this</h2>
        <p>
          We mean it. The platform was designed to be forkable. If you want to run a Tahti instance
          for your local music community, regional scene, or artist collective:
        </p>
        <ol>
          <li>
            Clone the repository and follow the setup guide in <code>README.md</code>.
          </li>
          <li>
            The infrastructure is described in <code>infra/</code> — Docker Compose stack with
            Postgres, Redis, MinIO, Liquidsoap, and Caddy.
          </li>
          <li>
            The worker services (broadcast orchestrator, Tahti Radio, grant engine) are standalone
            Node.js processes in <code>services/</code>.
          </li>
          <li>
            Open an issue on GitHub if you are setting up a fork — we will help you get unstuck and
            list your fork in our documentation.
          </li>
        </ol>

        <h2>Running a commercial fork?</h2>
        <p>
          If you are running a for-profit fork as a SaaS product, AGPL still requires you to publish
          your source. We also ask that you reach out:{' '}
          <a href="mailto:tech@tahti.live">tech@tahti.live</a>. We are happy to discuss licensing
          arrangements and may be able to offer commercial support.
        </p>

        <h2>Licence text</h2>
        <p>
          The full licence text is in the repository at{' '}
          <a
            href="https://github.com/tahti-live/tahti-org/blob/main/LICENCE"
            rel="noopener noreferrer"
          >
            LICENCE
          </a>
          . The short version: GNU AGPL version 3, no additional terms.
        </p>
      </div>
    </div>
  )
}
