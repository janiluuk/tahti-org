// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { PublicPageHeader } from '@tahti/ui'

export const metadata: Metadata = {
  title: 'Privacy policy — Tahti',
  description: 'How Tahti ry collects, uses, and protects your personal data under GDPR.',
}

export default function PrivacyPage() {
  return (
    <div className="brand-public">
      <PublicPageHeader title="Privacy policy">
        Effective date: 1 August 2026. Data controller: Tahti ry, Finland.
      </PublicPageHeader>

      <div className="brand-prose">
        <h2>Who we are</h2>
        <p>
          Tahti ry (business ID to be registered) is a Finnish nonprofit association (yhdistys) and
          the data controller for personal data processed through the tahti.live platform. Contact:{' '}
          <a href="mailto:tietosuoja@tahti.live">tietosuoja@tahti.live</a>.
        </p>

        <h2>What we collect and why</h2>
        <dl>
          <dt>Account data</dt>
          <dd>
            Email address, username, display name, optional avatar and bio. Collected when you
            register. Used to operate your account, authenticate you, and let listeners find you.
          </dd>
          <dt>Payment data</dt>
          <dd>
            Stripe processes all card payments. We receive a Stripe customer ID and subscription
            status. We do not store card numbers or bank details.
          </dd>
          <dt>Content you upload</dt>
          <dd>
            Audio files, release metadata, tracklists, images, and newsletter text. Stored to
            provide the platform service. You retain full copyright.
          </dd>
          <dt>Usage data</dt>
          <dd>
            Play counts, download counts, and fan subscription activity. Used to calculate your
            engagement units for the annual grant distribution. Aggregated totals are published on
            the transparency page (with your consent for attribution).
          </dd>
          <dt>Newsletter data</dt>
          <dd>
            If listeners subscribe to your newsletter, their email addresses are stored on your
            behalf. You are the data controller for your subscriber list; we are the processor.
          </dd>
          <dt>Technical logs</dt>
          <dd>
            Server access logs (IP address, user agent, timestamp) retained for 30 days for security
            and debugging. Not used for profiling or advertising.
          </dd>
        </dl>

        <h2>Cookies</h2>
        <p>
          We use one session cookie (<code>tahti_session</code>) to keep you logged in. It is
          strictly necessary for authentication and cannot be opted out while using the platform. We
          do not use advertising cookies, tracking pixels, or third-party analytics scripts.
        </p>

        <h2>Who we share data with</h2>
        <ul>
          <li>
            <strong>Stripe</strong> — payment processing. Their privacy policy applies to payment
            data.
          </li>
          <li>
            <strong>Hetzner / UpCloud</strong> — infrastructure hosting within the EU/EEA.
          </li>
          <li>
            <strong>Revelator</strong> — music distribution to DSPs, if you opt in to distribution.
            Only release metadata (title, ISRC, credits) is shared, not personal account data.
          </li>
        </ul>
        <p>
          We do not sell data, share data with advertisers, or transfer data outside the EU/EEA
          without Standard Contractual Clauses.
        </p>

        <h2>How long we keep data</h2>
        <ul>
          <li>Account data: kept while your account is active, plus 1 year after deletion.</li>
          <li>
            Upload content: deleted within 30 days of account deletion (or immediately on request).
          </li>
          <li>Payment records: 7 years (Finnish accounting law).</li>
          <li>Engagement unit data: 7 years (required for grant audit trail).</li>
          <li>Server logs: 30 days.</li>
        </ul>

        <h2>Your rights under GDPR</h2>
        <p>You have the right to:</p>
        <ul>
          <li>
            <strong>Access</strong> — request a copy of all personal data we hold about you.
          </li>
          <li>
            <strong>Rectification</strong> — correct inaccurate data.
          </li>
          <li>
            <strong>Erasure</strong> — delete your account and personal data.
          </li>
          <li>
            <strong>Portability</strong> — export your data (releases, archive, analytics) in
            machine-readable format from the dashboard settings.
          </li>
          <li>
            <strong>Objection</strong> — object to processing for legitimate interests.
          </li>
          <li>
            <strong>Restriction</strong> — restrict processing while a dispute is resolved.
          </li>
        </ul>
        <p>
          To exercise any right, email{' '}
          <a href="mailto:tietosuoja@tahti.live">tietosuoja@tahti.live</a>. We respond within 30
          days. If you are not satisfied, you may lodge a complaint with the Finnish Data Protection
          Ombudsman (tietosuoja.fi).
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We will notify registered artists by email of any material changes at least 30 days before
          they take effect. The current version is always at this URL.
        </p>
      </div>
    </div>
  )
}
