// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { Panel } from '@tahti/ui'

type AccountSettingsProps = {
  email: string
  username: string
  membership: ReactNode
  social: ReactNode
  importConnections: ReactNode
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
  importConnections,
  mentions,
  domain,
  privacy,
}: AccountSettingsProps) {
  return (
    <div className="studio-account">
      <div className="studio-page-header studio-section-anchor">
        <div>
          <h2 className="studio-page-title">Settings</h2>
          <p className="studio-text-muted-sm studio-mt-xs">
            Membership, connections, domain, and privacy for{' '}
            <span className="studio-account__identity">{email}</span>
          </p>
        </div>
      </div>

      <div className="studio-settings-stack">
        {membership}

        <Panel title="Account" headerTight description="Your public artist identity on Tahti.">
          <dl className="studio-dl">
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
        {importConnections}
        {mentions}
        {domain}
        {privacy}
      </div>
    </div>
  )
}
