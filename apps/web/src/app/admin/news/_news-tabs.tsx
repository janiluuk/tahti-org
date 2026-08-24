// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@tahti/ui'
import { TestNotificationPanel } from './_test-notification-panel'

export function NewsTabs({ newsPanel }: { newsPanel: ReactNode }) {
  const [tab, setTab] = useState<'news' | 'test-notification'>('news')

  return (
    <div>
      <div className="admin-row studio-mt-sm" style={{ gap: '0.5rem' }}>
        <Button
          type="button"
          variant={tab === 'news' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setTab('news')}
        >
          News posts
        </Button>
        <Button
          type="button"
          variant={tab === 'test-notification' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setTab('test-notification')}
        >
          Send test notification
        </Button>
      </div>
      <div className="studio-mt-lg">{tab === 'news' ? newsPanel : <TestNotificationPanel />}</div>
    </div>
  )
}
