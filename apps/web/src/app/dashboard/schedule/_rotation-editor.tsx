// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState, useTransition } from 'react'
import { MAX_FALLBACK_ITEMS, type FallbackMode } from '@tahti/shared'
import { Alert, Button, ButtonIcon, Field, Panel, Select, Text } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'
import { usePlayer } from '@/contexts/player-context'
import {
  addLibraryTrackToRotation,
  updateChannelProgramme,
  type ProgrammeItemRow,
  type ProgrammeLibraryTrackRow,
  type ProgrammeView,
} from '../programme-actions'

function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Compact preview-play button, shared by both the rotation list and the add-picker
 * — auditions a track through the same global player used everywhere else, rather
 * than a second one-off audio element just for this editor. */
function PreviewPlayButton({
  id,
  title,
  audioUrl,
}: {
  id: string
  title: string
  audioUrl: string | null
}) {
  const { track, playing, togglePlay, load } = usePlayer()
  const isCurrent = track?.id === `programme-preview-${id}`

  if (!audioUrl) return null

  async function handleClick() {
    if (!isCurrent) {
      load(
        { id: `programme-preview-${id}`, kind: 'archive', url: audioUrl!, title },
        { autoplay: true },
      )
      return
    }
    await togglePlay()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void handleClick()}
      aria-label={isCurrent && playing ? `Pause ${title}` : `Preview ${title}`}
    >
      <ButtonIcon name="play" />
      {isCurrent && playing ? 'Pause' : 'Play'}
    </Button>
  )
}

type ProgrammeActionResult = { data: ProgrammeView | null; error: string | null }

export function RotationEditor({
  initial,
  channelSlug,
  updateProgramme = updateChannelProgramme,
  addLibraryTrack = addLibraryTrackToRotation,
}: {
  initial: ProgrammeView
  channelSlug: string
  /** Defaults to the artist's own /api/me/channel/programme actions — the admin
   * equivalent (edit-any-channel) passes slug-scoped /api/admin/... actions
   * instead, reusing this whole component rather than a second copy of it. */
  updateProgramme?: (payload: {
    fallbackMode?: FallbackMode
    fallbackEnabled?: boolean
    fallbackAutoEnroll?: boolean
    items?: Array<{ archiveItemId: string; isFallback: boolean; fallbackOrder?: number }>
  }) => Promise<ProgrammeActionResult>
  addLibraryTrack?: (releaseTrackId: string) => Promise<ProgrammeActionResult>
}) {
  const [fallbackMode, setFallbackMode] = useState<FallbackMode>(initial.fallbackMode)
  const [fallbackEnabled, setFallbackEnabled] = useState(initial.fallbackEnabled)
  const [fallbackAutoEnroll, setFallbackAutoEnroll] = useState(initial.fallbackAutoEnroll)
  const [items, setItems] = useState<ProgrammeItemRow[]>(initial.items)
  const [library, setLibrary] = useState<ProgrammeLibraryTrackRow[]>(initial.library)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pickerTab, setPickerTab] = useState<'archive' | 'library'>('archive')
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const inRotation = useMemo(() => items.filter((r) => r.isFallback), [items])
  const atCap = inRotation.length >= MAX_FALLBACK_ITEMS
  const availableArchive = useMemo(
    () => items.filter((r) => r.status === 'READY' && !r.isFallback),
    [items],
  )

  function applyView(view: ProgrammeView) {
    setFallbackMode(view.fallbackMode)
    setFallbackEnabled(view.fallbackEnabled)
    setFallbackAutoEnroll(view.fallbackAutoEnroll)
    setItems(view.items)
    setLibrary(view.library)
  }

  function addArchiveItem(id: string) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, isFallback: true } : r)))
  }

  function removeFromRotation(id: string) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, isFallback: false } : r)))
  }

  function reorder(fromIdx: number, toIdx: number) {
    setItems((prev) => {
      const rotation = prev.filter((r) => r.isFallback)
      const rest = prev.filter((r) => !r.isFallback)
      const next = [...rotation]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved!)
      return [...next, ...rest]
    })
  }

  function save() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const rotation = items.filter((r) => r.isFallback)
      const res = await updateProgramme({
        fallbackMode,
        fallbackEnabled,
        fallbackAutoEnroll,
        items: items.map((r) => ({
          archiveItemId: r.id,
          isFallback: r.isFallback,
          fallbackOrder: rotation.includes(r) ? rotation.indexOf(r) : undefined,
        })),
      })
      if (res.error || !res.data) {
        setError(res.error ?? 'Save failed')
        return
      }
      applyView(res.data)
      setMessage('Rotation saved.')
    })
  }

  function promoteLibraryTrack(releaseTrackId: string) {
    setError(null)
    setMessage(null)
    setPromotingId(releaseTrackId)
    startTransition(async () => {
      const res = await addLibraryTrack(releaseTrackId)
      setPromotingId(null)
      if (res.error || !res.data) {
        setError(res.error ?? 'Could not add track')
        return
      }
      applyView(res.data)
      setMessage('Added to rotation.')
    })
  }

  return (
    <div className="studio-channel-editor">
      <Panel
        title="24/7 rotation"
        headerTight
        description={
          <Text size="sm" tone="muted">
            Your rotation plays automatically whenever your channel is offline, looping continuously
            until you go live again — or turn it off below.
          </Text>
        }
      >
        <div className="studio-row studio-row--wrap studio-gap-md studio-mt-sm">
          <label className="studio-toggle-row">
            <input
              type="checkbox"
              className="studio-toggle-checkbox"
              checked={fallbackEnabled}
              disabled={isPending}
              onChange={(e) => setFallbackEnabled(e.target.checked)}
            />
            <span className="studio-toggle-label">
              {fallbackEnabled ? '24/7 rotation is on' : 'Rotation stopped — channel goes silent'}
            </span>
          </label>

          <Field label="Rotation mode" htmlFor="fallback-mode">
            <Select
              id="fallback-mode"
              value={fallbackMode}
              disabled={isPending}
              onChange={(e) => setFallbackMode(e.target.value as FallbackMode)}
            >
              <option value="shuffle">Shuffle (fair rotation)</option>
              <option value="ordered">Manual (drag to reorder)</option>
              <option value="time">By time added</option>
              <option value="name">By name</option>
            </Select>
          </Field>

          <label className="studio-toggle-row">
            <input
              type="checkbox"
              className="studio-toggle-checkbox"
              checked={fallbackAutoEnroll}
              disabled={isPending}
              onChange={(e) => setFallbackAutoEnroll(e.target.checked)}
            />
            <span className="studio-toggle-label">
              Auto-add new uploads to rotation (up to {MAX_FALLBACK_ITEMS})
            </span>
          </label>
        </div>

        {error && (
          <Alert variant="error" className="studio-mt-md">
            {error}
          </Alert>
        )}
        {message && (
          <Alert variant="success" className="studio-mt-md">
            {message}
          </Alert>
        )}

        <Button
          type="button"
          variant="primary"
          className="studio-mt-md"
          disabled={isPending}
          onClick={save}
        >
          <ButtonIcon name="save" />
          {isPending ? 'Saving…' : 'Save rotation'}
        </Button>
      </Panel>

      <div className="studio-channel-editor__layout">
        <div className="studio-channel-editor__preview-col">
          <Panel
            title={`In rotation — ${inRotation.length}/${MAX_FALLBACK_ITEMS}`}
            headerTight
            description={
              fallbackMode === 'ordered' ? (
                <Text size="sm" tone="muted">
                  Drag to reorder — this is the play order.
                </Text>
              ) : (
                <Text size="sm" tone="muted">
                  Shuffle favours sets that have not played recently. Order does not matter here.
                </Text>
              )
            }
          >
            {inRotation.length === 0 ? (
              <Text size="sm" tone="muted" className="studio-mt-md">
                Nothing in rotation yet — add sets or tracks from the right.
              </Text>
            ) : (
              <ul className="studio-list studio-mt-md schedule-rotation-list">
                {inRotation.map((row, index) => (
                  <li
                    key={row.id}
                    className={`studio-programme-row schedule-rotation-row${
                      fallbackMode === 'ordered' ? ' schedule-rotation-row--draggable' : ''
                    }`}
                    draggable={fallbackMode === 'ordered'}
                    onDragStart={() => setDragIdx(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragIdx !== null && dragIdx !== index) reorder(dragIdx, index)
                      setDragIdx(null)
                    }}
                  >
                    {fallbackMode === 'ordered' && (
                      <span className="schedule-rotation-row__handle" aria-hidden>
                        ⠿
                      </span>
                    )}
                    <span className="studio-programme-label">
                      <span>{row.title}</span>
                      {row.durationSec != null && (
                        <Text size="sm" tone="muted">
                          {formatDuration(row.durationSec)}
                        </Text>
                      )}
                    </span>
                    <PreviewPlayButton id={row.id} title={row.title} audioUrl={row.audioUrl} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => removeFromRotation(row.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="studio-channel-editor__controls-col">
          <Panel title="Add to rotation" headerTight>
            <div className="studio-row studio-gap-xs studio-mb-md">
              <Button
                type="button"
                variant={pickerTab === 'archive' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setPickerTab('archive')}
              >
                Archive
              </Button>
              <Button
                type="button"
                variant={pickerTab === 'library' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setPickerTab('library')}
              >
                Library
              </Button>
            </div>

            {pickerTab === 'archive' ? (
              availableArchive.length === 0 ? (
                <Text size="sm" tone="muted">
                  No more ready archive sets to add. Upload sets from the Archive page.
                </Text>
              ) : (
                <ul className="studio-list">
                  {availableArchive.map((row) => (
                    <li key={row.id} className="studio-programme-row">
                      <span className="studio-programme-label">
                        <span>{row.title}</span>
                        {row.durationSec != null && (
                          <Text size="sm" tone="muted">
                            {formatDuration(row.durationSec)}
                          </Text>
                        )}
                      </span>
                      <PreviewPlayButton id={row.id} title={row.title} audioUrl={row.audioUrl} />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isPending || atCap}
                        title={atCap ? `Rotation is full (max ${MAX_FALLBACK_ITEMS})` : undefined}
                        onClick={() => addArchiveItem(row.id)}
                      >
                        + Add
                      </Button>
                    </li>
                  ))}
                </ul>
              )
            ) : library.length === 0 ? (
              <Text size="sm" tone="muted">
                No published release tracks yet — publish a release to pull tracks into rotation.
              </Text>
            ) : (
              <ul className="studio-list">
                {library.map((track) => {
                  const linkedItem = track.archiveItemId
                    ? items.find((i) => i.id === track.archiveItemId)
                    : undefined
                  const active = linkedItem?.isFallback ?? false
                  return (
                    <li key={track.releaseTrackId} className="studio-programme-row">
                      <span className="studio-programme-label">
                        <span>
                          {track.releaseTitle} — {track.trackTitle}
                        </span>
                        {track.durationSec != null && (
                          <Text size="sm" tone="muted">
                            {formatDuration(track.durationSec)}
                          </Text>
                        )}
                      </span>
                      {active ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => removeFromRotation(linkedItem!.id)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isPending || atCap}
                          title={atCap ? `Rotation is full (max ${MAX_FALLBACK_ITEMS})` : undefined}
                          onClick={() => promoteLibraryTrack(track.releaseTrackId)}
                        >
                          {promotingId === track.releaseTrackId ? 'Adding…' : '+ Add'}
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Text size="sm" tone="muted">
        Looking for your next live show time instead?{' '}
        <a href={resolveChannelUrl(channelSlug)} target="_blank" rel="noopener noreferrer">
          Preview your channel →
        </a>
      </Text>
    </div>
  )
}
