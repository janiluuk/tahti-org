// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { createNewsletterDraft, sendNewsletterDraft } from './actions'

interface SubscriberStats {
  total: number
  confirmed: number
  newLast30Days: number
}

interface DraftRow {
  id: string
  subject: string
  state: string
  sentAt: string | null
  createdAt: string
  subscribersOnly: boolean
  _count: { sends: number }
}

export default function NewsletterPanel({
  initialStats,
  initialDrafts,
  hasFanNewsletterPerk,
  tier,
}: {
  initialStats: SubscriberStats
  initialDrafts: DraftRow[]
  hasFanNewsletterPerk: boolean
  tier: string
}) {
  const [stats] = useState(initialStats)
  const [drafts, setDrafts] = useState(initialDrafts)
  const [subject, setSubject] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [subscribersOnly, setSubscribersOnly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const weeklyHint =
    tier === 'STUDIO'
      ? 'Unlimited sends per week (Studio tier).'
      : tier === 'ARTIST'
        ? 'Up to 4 newsletters per week (Artist tier).'
        : 'Up to 1 newsletter per week (Free tier).'

  async function handleCreate() {
    const subj = subject.trim()
    const body = bodyMd.trim()
    if (!subj || !body) return
    if (subscribersOnly && !hasFanNewsletterPerk) {
      setError('Add FAN_NEWSLETTER to a fan tier before creating fan-only drafts.')
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    const result = await createNewsletterDraft({ subject: subj, bodyMd: body, subscribersOnly })
    if (result.error) {
      setError(result.error)
    } else if (result.draft) {
      setDrafts((prev) => [result.draft!, ...prev])
      setSubject('')
      setBodyMd('')
      setSubscribersOnly(false)
      setMessage('Draft saved.')
    }
    setSaving(false)
  }

  async function handleSend(draftId: string, audience: 'all' | 'fans') {
    setSendingId(draftId)
    setError(null)
    setMessage(null)
    const result = await sendNewsletterDraft({ draftId, audience })
    if (result.error) {
      setError(result.error)
    } else {
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draftId
            ? {
                ...d,
                state: 'QUEUED',
                _count: { sends: result.queued ?? d._count.sends },
              }
            : d,
        ),
      )
      setMessage(
        result.queued != null
          ? `Queued for ${result.queued} ${result.audience === 'fans' ? 'fan ' : ''}subscriber${result.queued === 1 ? '' : 's'}.`
          : 'Newsletter queued.',
      )
    }
    setSendingId(null)
  }

  return (
    <div className="studio-panel-section">
      <h2 className="studio-section-heading studio-section-heading--tight">Newsletter</h2>
      <p className="studio-help">Email your subscribers from your artist profile. {weeklyHint}</p>

      <div className="studio-row studio-row--wrap studio-gap-lg studio-mb-lg studio-text-sm">
        <span>
          <strong>{stats.confirmed}</strong> confirmed
        </span>
        <span className="studio-text-muted-sm">{stats.total} total signups</span>
        <span className="studio-text-muted-sm">+{stats.newLast30Days} last 30 days</span>
      </div>

      <div className="studio-field">
        <label className="studio-label">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          disabled={saving}
          className="studio-input"
        />
      </div>

      <div className="studio-field studio-mb-md">
        <label className="studio-label">Body (Markdown)</label>
        <textarea
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          rows={6}
          disabled={saving}
          className="studio-textarea"
        />
      </div>

      <label
        className={`studio-label-row studio-mb-md${hasFanNewsletterPerk ? '' : ' studio-label-row--disabled'}`}
      >
        <input
          type="checkbox"
          checked={subscribersOnly}
          onChange={(e) => setSubscribersOnly(e.target.checked)}
          disabled={!hasFanNewsletterPerk || saving}
        />
        Fan subscribers only (requires FAN_NEWSLETTER on a fan tier)
      </label>

      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={saving || !subject.trim() || !bodyMd.trim()}
        className="studio-btn-dark"
      >
        {saving ? 'Saving…' : 'Save draft'}
      </button>

      {drafts.length > 0 && (
        <div className="studio-mt-xl">
          <h3 className="studio-text-strong-sm studio-mb-md">Drafts & sends</h3>
          <ul className="studio-list">
            {drafts.map((d) => (
              <li key={d.id} className="studio-draft-card">
                <div className="studio-card-row">
                  <div>
                    <strong className="studio-text-strong-sm">{d.subject}</strong>
                    {d.subscribersOnly && (
                      <span className="studio-badge studio-badge--fans">fans only</span>
                    )}
                    <p className="studio-text-muted-sm studio-mt-sm studio-m-0">
                      {d.state === 'DRAFT' && 'Draft'}
                      {d.state === 'QUEUED' && 'Sending…'}
                      {d.state === 'SENT' &&
                        `Sent ${d.sentAt ? new Date(d.sentAt).toLocaleDateString() : ''} · ${d._count.sends} recipients`}
                    </p>
                  </div>
                  {d.state === 'DRAFT' && (
                    <div className="studio-actions studio-actions--sm">
                      {d.subscribersOnly ? (
                        <SendButton
                          label="Send to fans"
                          disabled={sendingId === d.id}
                          onClick={() => void handleSend(d.id, 'fans')}
                        />
                      ) : (
                        <>
                          <SendButton
                            label="Send to all"
                            disabled={sendingId === d.id}
                            onClick={() => void handleSend(d.id, 'all')}
                          />
                          {hasFanNewsletterPerk && (
                            <SendButton
                              label="Send to fans"
                              disabled={sendingId === d.id}
                              secondary
                              onClick={() => void handleSend(d.id, 'fans')}
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="studio-text-error studio-mt-md">{error}</p>}
      {message && <p className="studio-text-success studio-mt-md">{message}</p>}
    </div>
  )
}

function SendButton({
  label,
  onClick,
  disabled,
  secondary,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  secondary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={secondary ? 'studio-btn-outline' : 'studio-btn-primary'}
    >
      {disabled ? 'Sending…' : label}
    </button>
  )
}
