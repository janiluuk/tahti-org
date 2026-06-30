'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface Prefs {
  notifyMoneyMovesEmail: boolean
  notifyMoneyMovesInApp: boolean
  notifyListenerActivityEmail: boolean
  notifyWeeklyRecapEmail: boolean
}

export function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [saving, setSaving] = useState<keyof Prefs | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/me/notification-preferences`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<Prefs>) : null))
      .then((data) => {
        if (!cancelled && data) setPrefs(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle(key: keyof Prefs, value: boolean) {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaving(key)
    try {
      await fetch(`${API_BASE}/api/me/notification-preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      })
    } finally {
      setSaving(null)
    }
  }

  if (!prefs) return null

  return (
    <div className="notification-prefs">
      <div className="notification-prefs__hero" data-hero>
        <h2 className="notification-prefs__hero-title">How do you want to hear from Tahti?</h2>
      </div>

      <div className="notification-prefs__card">
        <h3 className="notification-prefs__card-title">Money moves</h3>
        <p className="studio-text-muted-sm">When fan-subs come in, when payouts complete</p>
        <div className="notification-prefs__toggles">
          <label className="studio-label-row studio-text-sm">
            <input
              type="checkbox"
              checked={prefs.notifyMoneyMovesEmail}
              disabled={saving === 'notifyMoneyMovesEmail'}
              onChange={(e) => void toggle('notifyMoneyMovesEmail', e.target.checked)}
            />
            Email me
          </label>
          <label className="studio-label-row studio-text-sm">
            <input
              type="checkbox"
              checked={prefs.notifyMoneyMovesInApp}
              disabled={saving === 'notifyMoneyMovesInApp'}
              onChange={(e) => void toggle('notifyMoneyMovesInApp', e.target.checked)}
            />
            In-app
          </label>
        </div>
        <div className="notification-prefs__preview">
          <span className="notification-prefs__preview-from">Tahti</span>
          <span className="notification-prefs__preview-body">@aurora_fi subscribed (€5/mo)</span>
        </div>
      </div>

      <div className="notification-prefs__card">
        <h3 className="notification-prefs__card-title">Listener actions</h3>
        <p className="studio-text-muted-sm">New chat messages, new comments, broadcast feedback</p>
        <div className="notification-prefs__toggles">
          <label className="studio-label-row studio-text-sm">
            <input
              type="checkbox"
              checked={prefs.notifyListenerActivityEmail}
              disabled={saving === 'notifyListenerActivityEmail'}
              onChange={(e) => void toggle('notifyListenerActivityEmail', e.target.checked)}
            />
            Email digest, daily
          </label>
        </div>
        <div className="notification-prefs__preview">
          <span className="notification-prefs__preview-from">Tahti</span>
          <span className="notification-prefs__preview-body">
            3 new chat messages, 1 new comment on Drift EP
          </span>
        </div>
      </div>

      <div className="notification-prefs__card">
        <h3 className="notification-prefs__card-title">Weekly recap</h3>
        <p className="studio-text-muted-sm">Your Sunday stats summary</p>
        <div className="notification-prefs__toggles">
          <label className="studio-label-row studio-text-sm">
            <input
              type="checkbox"
              checked={prefs.notifyWeeklyRecapEmail}
              disabled={saving === 'notifyWeeklyRecapEmail'}
              onChange={(e) => void toggle('notifyWeeklyRecapEmail', e.target.checked)}
            />
            Email me
          </label>
        </div>
        <div className="notification-prefs__preview">
          <span className="notification-prefs__preview-from">Tahti</span>
          <span className="notification-prefs__preview-body">
            1,247 plays · 89 downloads · €115 this week
          </span>
        </div>
      </div>
    </div>
  )
}
