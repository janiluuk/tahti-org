// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import type { NotificationView } from '@tahti/shared'
import { dismissNotification } from './notification-actions'

function StickyItem({
  notification,
  onDismiss,
}: {
  notification: NotificationView
  onDismiss: (id: string) => void
}) {
  const [pending, setPending] = useState(false)

  async function handleDismiss() {
    setPending(true)
    await dismissNotification(notification.id)
    onDismiss(notification.id)
  }

  const content = (
    <>
      <strong>{notification.title}</strong>
      {notification.body && <span> — {notification.body}</span>}
    </>
  )

  return (
    <div className="pinned-announcement" role="alert">
      <div
        className="pinned-announcement__body"
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        <span style={{ flex: 1 }}>
          {notification.url ? <a href={notification.url}>{content}</a> : content}
        </span>
        <button
          type="button"
          className="ui-btn ui-btn--secondary ui-btn--sm"
          disabled={pending}
          onClick={() => void handleDismiss()}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

/** Notifications that must be explicitly dismissed, not just cleared by
 * opening the ordinary bell dropdown — starts with the theme review
 * lifecycle. Fetched separately from NotificationBell's own list. */
export function StickyNotificationBanner({ initial }: { initial: NotificationView[] }) {
  const [items, setItems] = useState(initial)
  if (items.length === 0) return null

  return (
    <div
      className="studio-mt-sm"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
      {items.map((n) => (
        <StickyItem
          key={n.id}
          notification={n}
          onDismiss={(id) => setItems((prev) => prev.filter((item) => item.id !== id))}
        />
      ))}
    </div>
  )
}
