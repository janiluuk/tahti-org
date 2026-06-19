// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { Panel } from '@tahti/ui'

type AccountSettingsProps = {
  email: string
  username: string
  membership: ReactNode
  social: ReactNode
  mentions: ReactNode
  domain: ReactNode
  privacy: ReactNode
}

/** Account tab — grouped settings matching studio page patterns. */
export function AccountSettings({
  email,
  username,
  membership,
  social,
  mentions,
  domain,
  privacy,
}: AccountSettingsProps) {
  return (
    <div className="studio-account" id="account">
      <div className="studio-page-header studio-section-anchor">
        <div>
          <h2 className="studio-page-title">Settings</h2>
          <p className="studio-text-muted-sm studio-mt-xs">
            Membership, connections, domain, and privacy for{' '}
            <span className="studio-account__identity">{email}</span>
          </p>
        </div>
      </div>

      <section className="studio-account__section" aria-labelledby="account-membership">
        <h3 className="studio-account__section-label" id="account-membership">
          Membership
        </h3>
        {membership}
      </section>

      <section className="studio-account__section" aria-labelledby="account-profile">
        <h3 className="studio-account__section-label" id="account-profile">
          Profile &amp; connections
        </h3>
        <Panel title="Account" headerTight description="Your public artist identity on Tahti.">
          <dl className="studio-dl studio-mt-sm">
            <div className="studio-dl__row">
              <dt className="studio-dl__term">Username</dt>
              <dd className="studio-dl__value">
                <code>@{username}</code>
              </dd>
            </div>
            <div className="studio-dl__row">
              <dt className="studio-dl__term">Email</dt>
              <dd className="studio-dl__value">{email}</dd>
            </div>
          </dl>
        </Panel>
        {social}
        {mentions}
      </section>

      <section className="studio-account__section" aria-labelledby="account-channel">
        <h3 className="studio-account__section-label" id="account-channel">
          Channel
        </h3>
        {domain}
      </section>

      <section className="studio-account__section" aria-labelledby="account-privacy">
        <h3 className="studio-account__section-label" id="account-privacy">
          Privacy &amp; data
        </h3>
        {privacy}
      </section>
    </div>
  )
}
