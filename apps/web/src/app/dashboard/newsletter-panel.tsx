// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Panel } from '@tahti/ui'
import { createNewsletterDraft, sendNewsletterDraft } from './actions'
import { renderNewsletterPreview } from '@/lib/render-newsletter-preview'

interface SubscriberStats {
  total: number
  confirmed: number
  newLast30Days: number
  fanSubscriberCount: number
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
  displayName,
}: {
  initialStats: SubscriberStats
  initialDrafts: DraftRow[]
  hasFanNewsletterPerk: boolean
  tier: string
  displayName: string
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
  const [justSavedId, setJustSavedId] = useState<string | null>(null)

  const weeklyHint =
    tier === 'STUDIO'
      ? 'Unlimited sends per week (Studio tier).'
      : tier === 'ARTIST'
        ? 'Up to 4 newsletters per week (Artist tier).'
        : 'Up to 1 newsletter per week (Free tier).'

  const newsletterOnlyCount = Math.max(0, stats.confirmed - stats.fanSubscriberCount)
  const recipientLine = subscribersOnly
    ? `Sending to ${stats.fanSubscriberCount} fan subscriber${stats.fanSubscriberCount === 1 ? '' : 's'}.`
    : stats.fanSubscriberCount > 0
      ? `Sending to ${stats.confirmed} people — ${stats.fanSubscriberCount} fan-subscriber${stats.fanSubscriberCount === 1 ? '' : 's'} + ${newsletterOnlyCount} newsletter-only.`
      : `Sending to ${stats.confirmed} subscriber${stats.confirmed === 1 ? '' : 's'}.`

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
      setJustSavedId(result.draft.id)
      setSubject('')
      setBodyMd('')
      setSubscribersOnly(false)
      setMessage(null)
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
      if (justSavedId === draftId) setJustSavedId(null)
    }
    setSendingId(null)
  }

  return (
    <Panel
      title="Newsletter"
      headerTight
      description={`Email your subscribers from your artist profile. ${weeklyHint}`}
      className="import-page__panel studio-mt-lg"
      flushTop
    >
      <p className="nl-recipient-line studio-mb-sm">{recipientLine}</p>
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

      <div className="nl-compose-grid studio-mb-md">
        <div className="studio-field">
          <label className="nl-compose-label" htmlFor="newsletter-body">
            Body · Markdown
          </label>
          <textarea
            id="newsletter-body"
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            rows={10}
            disabled={saving}
            className="studio-textarea"
          />
        </div>

        <div className="studio-field">
          <span className="nl-compose-label">Preview · how it lands in inbox</span>
          <div className="nl-preview-card">
            <div className="nl-preview-from">
              <span className="nl-preview-avatar" aria-hidden>
                {displayName.charAt(0).toUpperCase()}
              </span>
              <div>
                <div className="nl-preview-from-name">{displayName} via Tahti</div>
                <div className="nl-preview-from-email">noreply@tahti.live</div>
              </div>
            </div>
            {subject.trim() && <h2 className="nl-preview-subject">{subject}</h2>}
            {bodyMd.trim() ? (
              <div
                className="nl-preview-body"
                dangerouslySetInnerHTML={{ __html: renderNewsletterPreview(bodyMd) }}
              />
            ) : (
              <p className="nl-preview-empty">Your newsletter body will appear here as you type.</p>
            )}
            <div className="nl-preview-footer">
              — {displayName} · <span>unsubscribe</span>
            </div>
          </div>
        </div>
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
        className="ui-btn ui-btn--primary"
      >
        {saving ? 'Saving…' : 'Save draft'}
      </button>

      {justSavedId &&
        (() => {
          const draft = drafts.find((d) => d.id === justSavedId)
          if (!draft || draft.state !== 'DRAFT') return null
          const target = draft.subscribersOnly ? stats.fanSubscriberCount : stats.confirmed
          return (
            <div className="nl-send-prompt studio-mt-md">
              <p className="studio-text-sm studio-mb-sm">
                Draft saved. Ready to send to {target} people?
              </p>
              <div className="studio-actions studio-actions--sm">
                <SendButton
                  label={`Send to ${target} people →`}
                  disabled={sendingId === draft.id}
                  onClick={() => void handleSend(draft.id, draft.subscribersOnly ? 'fans' : 'all')}
                />
              </div>
            </div>
          )
        })()}

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
      {message && <p className="studio-notice studio-notice--success studio-mt-md">{message}</p>}
    </Panel>
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
      className={
        secondary ? 'ui-btn ui-btn--sm ui-btn--secondary' : 'ui-btn ui-btn--sm ui-btn--primary'
      }
    >
      {disabled ? 'Sending…' : label}
    </button>
  )
}
