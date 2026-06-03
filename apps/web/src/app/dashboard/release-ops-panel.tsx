// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import {
  COLLECTING_SOCIETY_POINTERS,
  MUSICBRAINZ_SUBMIT_URL,
  POST_RELEASE_CLAIM_LINKS,
  RELEASE_CREDIT_ROLES,
  type ReleaseChecklistItem,
  type ReleaseCredit,
} from '@tahti/shared'
import { fetchReleaseExportJson, updateReleaseCatalog } from './release-actions'

type CatalogState = {
  upc: string
  musicbrainzReleaseId: string
  musicbrainzArtistId: string
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
}: {
  releaseId: string
  releaseTitle: string
  smartLinkSlug: string
  initial: CatalogState
  initialCredits: ReleaseCredit[]
  checklist: ReleaseChecklistItem[]
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(initial)
  const [credits, setCredits] = useState<ReleaseCredit[]>(
    initialCredits.length > 0 ? initialCredits : [],
  )
  const [checklist, setChecklist] = useState(initialChecklist)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
    <div style={{ marginTop: '0.75rem', borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          fontSize: '0.9rem',
          border: '1px solid #ccc',
          borderRadius: 4,
          padding: '0.25rem 0.6rem',
        }}
      >
        {open ? 'Hide' : 'Release ops'} ({doneCount}/{checklist.length})
      </button>

      {open && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: '#fafafa',
            borderRadius: 8,
          }}
        >
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>
            Catalog metadata for <strong>{releaseTitle}</strong> — smart link /r/{smartLinkSlug}.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
            {checklist.map((step) => (
              <li key={step.id} style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                <span style={{ marginRight: '0.35rem' }}>{step.done ? '✓' : '○'}</span>
                <strong>{step.label}</strong>
                {step.hint && (
                  <span style={{ color: '#888', marginLeft: '0.35rem' }}>— {step.hint}</span>
                )}
              </li>
            ))}
          </ul>

          <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 480 }}>
            <label>
              UPC / EAN
              <input
                value={form.upc}
                onChange={(e) => setForm({ ...form, upc: e.target.value })}
                disabled={isPending}
                style={{ display: 'block', width: '100%', marginTop: 2 }}
              />
            </label>
            <label>
              MusicBrainz release MBID
              <input
                value={form.musicbrainzReleaseId}
                onChange={(e) => setForm({ ...form, musicbrainzReleaseId: e.target.value })}
                disabled={isPending}
                style={{ display: 'block', width: '100%', marginTop: 2 }}
              />
            </label>
            <label>
              MusicBrainz artist MBID
              <input
                value={form.musicbrainzArtistId}
                onChange={(e) => setForm({ ...form, musicbrainzArtistId: e.target.value })}
                disabled={isPending}
                style={{ display: 'block', width: '100%', marginTop: 2 }}
              />
            </label>
            <label>
              P-line
              <input
                value={form.pLine}
                onChange={(e) => setForm({ ...form, pLine: e.target.value })}
                disabled={isPending}
                style={{ display: 'block', width: '100%', marginTop: 2 }}
              />
            </label>
            <label>
              C-line
              <input
                value={form.cLine}
                onChange={(e) => setForm({ ...form, cLine: e.target.value })}
                disabled={isPending}
                style={{ display: 'block', width: '100%', marginTop: 2 }}
              />
            </label>
            <label>
              Label imprint
              <input
                value={form.labelImprint}
                onChange={(e) => setForm({ ...form, labelImprint: e.target.value })}
                disabled={isPending}
                style={{ display: 'block', width: '100%', marginTop: 2 }}
              />
            </label>
          </div>

          <div style={{ marginTop: '1rem', maxWidth: 560 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Credits & roles
            </div>
            {credits.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: '#888', margin: '0 0 0.5rem' }}>
                No credits yet — add writers, performers, producers, etc.
              </p>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.5rem' }}>
              {credits.map((credit, index) => (
                <li
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr auto',
                    gap: '0.35rem',
                    marginBottom: '0.35rem',
                    alignItems: 'center',
                  }}
                >
                  <select
                    value={credit.role}
                    disabled={isPending}
                    onChange={(e) => {
                      const next = [...credits]
                      next[index] = { ...credit, role: e.target.value as ReleaseCredit['role'] }
                      setCredits(next)
                    }}
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
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setCredits(credits.filter((_, i) => i !== index))}
                    style={{ fontSize: '0.85rem' }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setCredits([...credits, { ...EMPTY_CREDIT }])}
              style={{ fontSize: '0.85rem' }}
            >
              Add credit
            </button>
          </div>

          {error && <p style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{error}</p>}

          <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" onClick={save} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save catalog'}
            </button>
            <button
              type="button"
              style={{ fontSize: '0.9rem' }}
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
            >
              Export JSON
            </button>
            <a
              href={MUSICBRAINZ_SUBMIT_URL}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.9rem' }}
            >
              Add on MusicBrainz →
            </a>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Post-release claim links
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
              {POST_RELEASE_CLAIM_LINKS.map((link) => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Collecting societies
            </div>
            <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 0.5rem' }}>
              Register your works and recordings with the relevant PRO — Tahti does not file on your
              behalf.
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
              {COLLECTING_SOCIETY_POINTERS.map((society) => (
                <li key={society.id} style={{ marginBottom: '0.35rem' }}>
                  <a href={society.url} target="_blank" rel="noreferrer">
                    {society.label}
                  </a>
                  <span style={{ color: '#888' }}> ({society.region})</span>
                  <span style={{ color: '#666' }}> — {society.hint}</span>
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
