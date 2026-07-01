// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import { ButtonIcon, Button } from '@tahti/ui'
import {
  COLLECTING_SOCIETY_POINTERS,
  DISCOGS_GUIDE_STEPS,
  DISCOGS_SUBMIT_URL,
  MUSICBRAINZ_GUIDE_STEPS,
  MUSICBRAINZ_SUBMIT_URL,
  POST_RELEASE_CLAIM_LINKS,
  RELEASE_CREDIT_ROLES,
  type ReleaseChecklistItem,
  type ReleaseCredit,
} from '@tahti/shared'
import {
  fetchReleaseExportJson,
  fetchRevelatorBilling,
  fetchRevelatorRoyalties,
  submitReleaseToRevelator,
  updateReleaseCatalog,
} from './release-actions'

type CatalogState = {
  upc: string
  musicbrainzReleaseId: string
  musicbrainzArtistId: string
  discogsReleaseId: string
  pLine: string
  cLine: string
  labelImprint: string
}

const EMPTY_CREDIT: ReleaseCredit = { role: 'writer', name: '' }

function parseCredits(value: unknown): ReleaseCredit[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (row): row is ReleaseCredit =>
      row &&
      typeof row === 'object' &&
      typeof (row as ReleaseCredit).name === 'string' &&
      RELEASE_CREDIT_ROLES.includes((row as ReleaseCredit).role),
  )
}

export default function ReleaseOpsPanel({
  releaseId,
  releaseTitle,
  smartLinkSlug,
  initial,
  initialCredits,
  checklist: initialChecklist,
  revelatorStatus: initialRevelatorStatus,
  revelatorId: initialRevelatorId,
}: {
  releaseId: string
  releaseTitle: string
  smartLinkSlug: string
  initial: CatalogState
  initialCredits: ReleaseCredit[]
  checklist: ReleaseChecklistItem[]
  revelatorStatus?: string | null
  revelatorId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(initial)
  const [credits, setCredits] = useState<ReleaseCredit[]>(
    initialCredits.length > 0 ? initialCredits : [],
  )
  const [checklist, setChecklist] = useState(initialChecklist)
  const [revelatorStatus, setRevelatorStatus] = useState(initialRevelatorStatus ?? null)
  const revelatorId = initialRevelatorId ?? null
  const [royalties, setRoyalties] = useState<
    Array<{
      id: string
      periodStart: string
      periodEnd: string
      amountCents: number
      currency: string
      streams: number | null
    }>
  >([])
  const [royaltiesLoaded, setRoyaltiesLoaded] = useState(false)
  const [billing, setBilling] = useState<{
    paid: boolean
    feeCents: number
    waived: boolean
    studioIncludedRemaining: number | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canSubmitRevelator = !revelatorStatus || revelatorStatus === 'failed'
  const showRoyalties = revelatorStatus === 'submitted' || revelatorStatus === 'delivered'

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetchRevelatorBilling(releaseId).then((res) => {
      if (cancelled || res.error) return
      setBilling({
        paid: res.paid,
        feeCents: res.feeCents,
        waived: res.waived,
        studioIncludedRemaining: res.studioIncludedRemaining,
      })
    })
    return () => {
      cancelled = true
    }
  }, [open, releaseId])

  useEffect(() => {
    if (!open || !showRoyalties || royaltiesLoaded) return
    let cancelled = false
    void fetchRevelatorRoyalties(releaseId).then((res) => {
      if (cancelled) return
      if (res.error) {
        setError(res.error)
      } else {
        setRoyalties(res.reports)
      }
      setRoyaltiesLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [open, showRoyalties, royaltiesLoaded, releaseId])

  function formatMoney(cents: number, currency: string) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100)
  }

  function save() {
    setError(null)
    const trimmedCredits = credits
      .map((c) => ({
        role: c.role,
        name: c.name.trim(),
        ...(c.artistUsername?.trim() ? { artistUsername: c.artistUsername.trim() } : {}),
      }))
      .filter((c) => c.name.length > 0)

    startTransition(async () => {
      const res = await updateReleaseCatalog(releaseId, {
        upc: form.upc.trim() || null,
        musicbrainzReleaseId: form.musicbrainzReleaseId.trim() || null,
        musicbrainzArtistId: form.musicbrainzArtistId.trim() || null,
        discogsReleaseId: form.discogsReleaseId.trim() || null,
        pLine: form.pLine.trim() || null,
        cLine: form.cLine.trim() || null,
        labelImprint: form.labelImprint.trim() || null,
        credits: trimmedCredits,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.checklist) setChecklist(res.checklist as ReleaseChecklistItem[])
    })
  }

  const doneCount = checklist.filter((c) => c.done).length

  return (
    <div className="studio-divider">
      <Button onClick={() => setOpen(!open)} variant="ghost">
        {open ? 'Hide' : 'Release ops'} ({doneCount}/{checklist.length})
      </Button>

      {open && (
        <div className="studio-editor-panel studio-mt-md">
          <p className="studio-text-muted-sm studio-m-0 studio-mb-md">
            Catalog metadata for <strong>{releaseTitle}</strong> — smart link /r/{smartLinkSlug}.
          </p>

          <ul className="studio-list studio-mb-lg">
            {checklist.map((step) => (
              <li key={step.id} className="studio-text-sm studio-mb-sm">
                <span className="studio-mr-sm">{step.done ? '✓' : '○'}</span>
                <strong>{step.label}</strong>
                {step.hint && <span className="studio-text-muted-sm"> — {step.hint}</span>}
              </li>
            ))}
          </ul>

          <div className="studio-grid studio-max-w-sm">
            {(
              [
                ['UPC / EAN', 'upc'],
                ['MusicBrainz release MBID', 'musicbrainzReleaseId'],
                ['MusicBrainz artist MBID', 'musicbrainzArtistId'],
                ['Discogs release ID', 'discogsReleaseId'],
                ['P-line', 'pLine'],
                ['C-line', 'cLine'],
                ['Label imprint', 'labelImprint'],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="studio-field">
                {label}
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  disabled={isPending}
                  className="studio-input studio-mt-sm"
                />
              </label>
            ))}
          </div>

          <div className="studio-mt-lg studio-max-w-md">
            <div className="studio-text-strong-sm studio-mb-sm">Credits & roles</div>
            {credits.length === 0 && (
              <p className="studio-empty">
                No credits yet — add writers, performers, producers, etc.
              </p>
            )}
            <ul className="studio-list studio-mb-sm">
              {credits.map((credit, index) => (
                <li key={index} className="studio-grid studio-grid--credits">
                  <select
                    value={credit.role}
                    disabled={isPending}
                    onChange={(e) => {
                      const next = [...credits]
                      next[index] = { ...credit, role: e.target.value as ReleaseCredit['role'] }
                      setCredits(next)
                    }}
                    className="studio-input"
                  >
                    {RELEASE_CREDIT_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <input
                    value={credit.name}
                    placeholder="Name"
                    disabled={isPending}
                    onChange={(e) => {
                      const next = [...credits]
                      next[index] = { ...credit, name: e.target.value }
                      setCredits(next)
                    }}
                    className="studio-input"
                  />
                  <Button
                    disabled={isPending}
                    onClick={() => setCredits(credits.filter((_, i) => i !== index))}
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              disabled={isPending}
              onClick={() => setCredits([...credits, { ...EMPTY_CREDIT }])}
              variant="ghost"
            >
              Add credit
            </Button>
          </div>

          {error && <p className="studio-text-error">{error}</p>}

          <div className="studio-actions studio-row--wrap studio-mt-md">
            <Button onClick={save} disabled={isPending} variant="primary">
              <ButtonIcon name="save" />
              {isPending ? 'Saving…' : 'Save catalog'}
            </Button>
            <Button
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const res = await fetchReleaseExportJson(releaseId)
                  if (res.error || !res.json) {
                    setError(res.error ?? 'Export failed')
                    return
                  }
                  const blob = new Blob([res.json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `release-${smartLinkSlug}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                })
              }}
              variant="ghost"
            >
              Export JSON
            </Button>
            <Button
              disabled={isPending}
              onClick={() => {
                setError(null)
                startTransition(async () => {
                  const res = await fetchReleaseExportJson(releaseId)
                  if (res.error || !res.json) {
                    setError(res.error ?? 'Export failed')
                    return
                  }
                  try {
                    const pack = JSON.parse(res.json) as { musicbrainzPrefill?: string }
                    const text = pack.musicbrainzPrefill
                    if (!text) {
                      setError('Export missing MusicBrainz prefill')
                      return
                    }
                    await navigator.clipboard.writeText(text)
                  } catch {
                    setError('Could not copy MusicBrainz prefill')
                  }
                })
              }}
              variant="ghost"
            >
              Copy MusicBrainz prefill
            </Button>
            <a
              href={MUSICBRAINZ_SUBMIT_URL}
              target="_blank"
              rel="noreferrer"
              className="studio-link-cta"
            >
              Add on MusicBrainz →
            </a>
            <Button
              disabled={isPending}
              onClick={() => {
                setError(null)
                startTransition(async () => {
                  const res = await fetchReleaseExportJson(releaseId)
                  if (res.error || !res.json) {
                    setError(res.error ?? 'Export failed')
                    return
                  }
                  try {
                    const pack = JSON.parse(res.json) as { discogsPrefill?: string }
                    const text = pack.discogsPrefill
                    if (!text) {
                      setError('Export missing Discogs prefill')
                      return
                    }
                    await navigator.clipboard.writeText(text)
                  } catch {
                    setError('Could not copy Discogs prefill')
                  }
                })
              }}
              variant="ghost"
            >
              Copy Discogs prefill
            </Button>
            <a
              href={DISCOGS_SUBMIT_URL}
              target="_blank"
              rel="noreferrer"
              className="studio-link-cta"
            >
              Search on Discogs →
            </a>
          </div>

          <div className="studio-subsection studio-mt-lg">
            <div className="studio-text-strong-sm studio-mb-sm">Revelator DSP delivery (M7)</div>
            <p className="studio-text-muted-sm studio-m-0 studio-mb-sm">
              Submits catalog metadata from this release to Revelator (Spotify, Apple, etc.).
              Requires UPC or ISRC on every track. Pre-fills from the fields above.
            </p>
            {revelatorStatus && (
              <p className="studio-text-sm studio-m-0 studio-mb-sm">
                Status: <strong>{revelatorStatus}</strong>
                {revelatorId && <span className="studio-text-muted-sm"> · id {revelatorId}</span>}
              </p>
            )}
            {billing && !billing.paid && (
              <p className="studio-text-muted-sm studio-m-0 studio-mb-sm">
                {billing.feeCents === 0 && billing.studioIncludedRemaining != null
                  ? `Studio included slot (${billing.studioIncludedRemaining} left this year)`
                  : `Distribution fee: ${formatMoney(billing.feeCents, 'EUR')}`}
              </p>
            )}
            {billing?.paid && (
              <p className="studio-text-muted-sm studio-m-0 studio-mb-sm">
                {billing.waived ? 'Fee waived (Studio included)' : 'Distribution fee paid'}
              </p>
            )}
            <Button
              disabled={isPending || !canSubmitRevelator}
              onClick={() => {
                setError(null)
                startTransition(async () => {
                  const res = await submitReleaseToRevelator(releaseId)
                  if (res.checkoutUrl) {
                    window.location.href = res.checkoutUrl
                    return
                  }
                  if (res.error) {
                    setError(res.error)
                    return
                  }
                  if (res.revelatorStatus) setRevelatorStatus(res.revelatorStatus)
                  setBilling((prev) => (prev ? { ...prev, paid: true } : prev))
                })
              }}
              variant="ghost"
            >
              {isPending
                ? 'Submitting…'
                : billing && !billing.paid && billing.feeCents > 0
                  ? `Pay ${formatMoney(billing.feeCents, 'EUR')} & submit`
                  : 'Submit to Revelator'}
            </Button>
            {showRoyalties && (
              <div className="studio-mt-md">
                <div className="studio-text-strong-sm studio-mb-sm">Royalty reports</div>
                {!royaltiesLoaded ? (
                  <p className="studio-text-muted-sm studio-m-0">Loading…</p>
                ) : royalties.length === 0 ? (
                  <p className="studio-empty">
                    No reports yet — synced monthly after DSP delivery.
                  </p>
                ) : (
                  <ul className="studio-list-indented studio-text-sm studio-m-0">
                    {royalties.map((row) => (
                      <li key={row.id}>
                        {row.periodStart.slice(0, 7)}: {formatMoney(row.amountCents, row.currency)}
                        {row.streams != null && (
                          <span className="studio-text-muted-sm"> · {row.streams} streams</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="studio-mt-lg">
            <div className="studio-text-strong-sm studio-mb-sm">MusicBrainz submission guide</div>
            <ol className="studio-list-indented studio-text-muted-sm">
              {MUSICBRAINZ_GUIDE_STEPS.map((step) => (
                <li key={step} className="studio-mb-sm">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="studio-mt-lg">
            <div className="studio-text-strong-sm studio-mb-sm">Discogs submission guide</div>
            <p className="studio-text-muted-sm studio-m-0 studio-mb-sm">
              Discogs is a community-edited database — entries go through a review queue. Tahti does
              not submit on your behalf; this guide and prefill just save you the typing.
            </p>
            <ol className="studio-list-indented studio-text-muted-sm">
              {DISCOGS_GUIDE_STEPS.map((step) => (
                <li key={step} className="studio-mb-sm">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="studio-mt-lg">
            <div className="studio-text-strong-sm studio-mb-sm">Post-release claim links</div>
            <ul className="studio-list-indented studio-text-sm">
              {POST_RELEASE_CLAIM_LINKS.map((link) => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="studio-mt-lg">
            <div className="studio-text-strong-sm studio-mb-sm">Collecting societies</div>
            <p className="studio-text-muted-sm studio-m-0 studio-mb-sm">
              Register your works and recordings with the relevant PRO — Tahti does not file on your
              behalf.
            </p>
            <ul className="studio-list-indented studio-text-sm">
              {COLLECTING_SOCIETY_POINTERS.map((society) => (
                <li key={society.id} className="studio-mb-sm">
                  <a href={society.url} target="_blank" rel="noreferrer">
                    {society.label}
                  </a>
                  <span className="studio-text-muted-sm"> ({society.region})</span>
                  <span className="studio-text-muted-sm"> — {society.hint}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export { parseCredits }
