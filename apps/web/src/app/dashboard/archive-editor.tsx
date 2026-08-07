// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { ButtonIcon, Button } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'
import { deleteArchiveItem, updateArchiveMetadata } from './archive-actions'
import {
  ArchiveBasicsFields,
  ArchiveTracklistField,
  ArchiveVisualsFields,
  ArchiveSharingFields,
  ArchiveAdvancedFields,
  metadataFormToPayload,
  metadataFromApi,
  type ArchiveMetadataFormState,
} from './archive-metadata-fields'
import { ArchiveVersionPanel } from './archive-version-panel'
import { ArchiveDownloadPanel } from './archive-download-panel'
import { ArchiveGateStats } from './archive-gate-stats'
import { ArchiveMixcloudUpload } from './archive-mixcloud'
import ArchiveVisualPanel from './archive-visual-panel'
import { AddToPlaylistButton } from './_add-to-playlist-button'

type EditorTab = 'basics' | 'tracklist' | 'visuals' | 'sharing' | 'advanced'

const EDITOR_TABS: { id: EditorTab; label: string; icon: string }[] = [
  { id: 'basics', label: 'Basics', icon: '📝' },
  { id: 'tracklist', label: 'Tracklist', icon: '🎼' },
  { id: 'visuals', label: 'Cover & visuals', icon: '🖼️' },
  { id: 'sharing', label: 'Sharing', icon: '🔗' },
  { id: 'advanced', label: 'Advanced', icon: '⚙️' },
]

export default function ArchiveEditor({
  item,
  mixcloudConnected,
  mixcloudConfigured,
  apiUrl,
  channelSlug,
}: {
  item: Record<string, unknown> & { id: string; title: string; status: string }
  mixcloudConnected: boolean
  mixcloudConfigured: boolean
  apiUrl: string
  channelSlug?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<EditorTab>('basics')
  const [title, setTitle] = useState(item.title)
  const [meta, setMeta] = useState<ArchiveMetadataFormState>(() => metadataFromApi(item))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updateArchiveMetadata(item.id, {
        title: title.trim(),
        ...metadataFormToPayload(meta),
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const res = await deleteArchiveItem(item.id)
    if (res.error) {
      setDeleting(false)
      setConfirmDelete(false)
      setError(res.error)
      return
    }
    router.refresh()
  }

  const detectedBpm = item.bpmDetected as number | null | undefined
  const detectedKey = item.keyDetected as string | null | undefined
  const isPublic = (item.isPublic as boolean | undefined) ?? true
  const isReady = item.status === 'READY'
  const [pinned, setPinned] = useState(Boolean(item.pinnedAt))
  const [pinPending, setPinPending] = useState(false)

  function togglePin() {
    setPinPending(true)
    const next = !pinned
    startTransition(async () => {
      const res = await updateArchiveMetadata(item.id, { pinned: next })
      if (!res.error) setPinned(next)
      setPinPending(false)
      router.refresh()
    })
  }

  const [inRotation, setInRotation] = useState(Boolean(item.isFallback))
  const [rotationPending, setRotationPending] = useState(false)
  const [swapCandidate, setSwapCandidate] = useState<{ id: string; title: string } | null>(null)
  const [rotationError, setRotationError] = useState<string | null>(null)

  function toggleRotation() {
    if (inRotation) {
      setRotationPending(true)
      setRotationError(null)
      startTransition(async () => {
        await updateArchiveMetadata(item.id, { isFallback: false })
        setInRotation(false)
        setRotationPending(false)
        router.refresh()
      })
      return
    }
    setRotationPending(true)
    setRotationError(null)
    startTransition(async () => {
      const res = await updateArchiveMetadata(item.id, { isFallback: true })
      if (res.oldestFallbackItem) {
        setSwapCandidate(res.oldestFallbackItem)
        setRotationPending(false)
        return
      }
      if (res.error) {
        setRotationError(res.error)
        setRotationPending(false)
        return
      }
      setInRotation(true)
      setRotationPending(false)
      router.refresh()
    })
  }

  function confirmSwap() {
    if (!swapCandidate) return
    setRotationPending(true)
    startTransition(async () => {
      const res = await updateArchiveMetadata(item.id, {
        isFallback: true,
        replaceFallbackItemId: swapCandidate.id,
      })
      if (res.error) {
        setRotationError(res.error)
        setRotationPending(false)
        return
      }
      setInRotation(true)
      setSwapCandidate(null)
      setRotationPending(false)
      router.refresh()
    })
  }

  return (
    <div className={`studio-item-row--list${open ? ' studio-item-row--list--active' : ''}`}>
      <div className="studio-card-row">
        <div>
          <div className="studio-stat-box-title">{item.title}</div>
          <div className="studio-text-muted-sm">
            {item.status as string}
            {pinned && ' · Pinned'}
            {inRotation && ' · In rotation'}
            {item.contentType != null && ` · ${String(item.contentType).replace(/_/g, ' ')}`}
            {item.genre != null && ` · ${String(item.genre)}`}
            {item.sourceFormat != null &&
              ` · Source: ${String(item.sourceFormat)}${
                item.sourceBitrateKbps != null
                  ? ` ${String(item.sourceBitrateKbps)} kbps`
                  : ' (lossless)'
              }`}
          </div>
        </div>
        {open ? (
          <Button onClick={() => setOpen(false)} variant="ghost" size="sm">
            Close
          </Button>
        ) : isReady && isPublic ? (
          <div className="studio-row-actions">
            {channelSlug && (
              <NextLink
                href={resolveChannelUrl(channelSlug)}
                className="ui-btn ui-btn--sm ui-btn--primary"
              >
                <ButtonIcon name="link" />
                View on channel →
              </NextLink>
            )}
            <Button onClick={() => setOpen(true)} variant="ghost" size="sm">
              <ButtonIcon name="edit" />
              Edit
            </Button>
            <details className="studio-row-more">
              <summary className="studio-row-more__summary">More</summary>
              <div className="studio-row-more__menu">
                <Button onClick={togglePin} disabled={pinPending} variant="ghost" size="sm">
                  {pinned ? 'Unpin from Stage' : 'Pin to Stage'}
                </Button>
                <Button
                  onClick={toggleRotation}
                  disabled={rotationPending}
                  variant="ghost"
                  size="sm"
                >
                  {inRotation ? 'Remove from rotation' : 'Add to rotation'}
                </Button>
                <AddToPlaylistButton archiveItemId={item.id} />
                <NextLink
                  href={`/dashboard/insights/archive/${item.id}`}
                  className="ui-btn ui-btn--sm ui-btn--ghost"
                >
                  Show insights
                </NextLink>
              </div>
            </details>
          </div>
        ) : isReady ? (
          <Button onClick={() => setOpen(true)} variant="primary" size="sm">
            <ButtonIcon name="send" />
            Polish &amp; publish →
          </Button>
        ) : (
          <Button onClick={() => setOpen(true)} variant="ghost" size="sm">
            Edit metadata
          </Button>
        )}
      </div>

      {swapCandidate && (
        <div className="studio-row studio-row--wrap studio-gap-xs studio-mt-sm">
          <span className="studio-text-sm">
            Rotation is full — remove &ldquo;{swapCandidate.title}&rdquo; to add &ldquo;
            {item.title}&rdquo;?
          </span>
          <Button
            onClick={() => setSwapCandidate(null)}
            disabled={rotationPending}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
          <Button onClick={confirmSwap} disabled={rotationPending} variant="primary" size="sm">
            <ButtonIcon name="check" />
            {rotationPending ? 'Swapping…' : 'Confirm swap'}
          </Button>
        </div>
      )}
      {rotationError && !swapCandidate && (
        <p className="studio-notice studio-notice--error studio-mt-sm">{rotationError}</p>
      )}

      {open && (
        <div className="studio-editor-panel">
          <label className="studio-field">
            <span className="studio-label">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
              className="studio-input studio-editor-title-input"
            />
          </label>

          <div className="studio-editor-tabs" role="tablist" aria-label="Track details">
            {EDITOR_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`studio-editor-tab studio-editor-tab--${t.id}${tab === t.id ? ' studio-editor-tab--active' : ''}`}
              >
                <span className="studio-editor-tab__icon" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="studio-editor-tab-panel">
            {tab === 'basics' && (
              <ArchiveBasicsFields state={meta} onChange={setMeta} disabled={isPending} />
            )}
            {tab === 'tracklist' && (
              <ArchiveTracklistField state={meta} onChange={setMeta} disabled={isPending} />
            )}
            {tab === 'visuals' && (
              <>
                <ArchiveVisualsFields
                  state={meta}
                  onChange={setMeta}
                  disabled={isPending}
                  itemId={item.id}
                />
                <ArchiveVisualPanel
                  itemId={item.id}
                  initial={{
                    visualPreset: ((item.visualPreset as string | undefined) ??
                      'MINIMAL') as import('@tahti/shared').VisualPreset,
                    colorSchemeJson: (item.colorSchemeJson as string | null | undefined) ?? null,
                    paletteJson: (item.paletteJson as string | null | undefined) ?? null,
                  }}
                />
              </>
            )}
            {tab === 'sharing' && (
              <>
                <ArchiveSharingFields
                  state={meta}
                  onChange={setMeta}
                  disabled={isPending}
                  itemId={item.id}
                />
                <ArchiveGateStats
                  itemId={item.id}
                  repostToDownload={meta.repostToDownload}
                  followToDownload={meta.followToDownload}
                />
                <ArchiveDownloadPanel itemId={item.id} />
              </>
            )}
            {tab === 'advanced' && (
              <>
                <ArchiveAdvancedFields
                  state={meta}
                  onChange={setMeta}
                  disabled={isPending}
                  detectedBpm={detectedBpm ?? null}
                  detectedKey={detectedKey ?? null}
                />
                <ArchiveVersionPanel
                  itemId={item.id}
                  itemStatus={item.status}
                  embedUri={item.embedUri as string | null | undefined}
                />
                <ArchiveMixcloudUpload
                  itemId={item.id}
                  itemStatus={item.status}
                  mixcloudConnected={mixcloudConnected}
                  mixcloudConfigured={mixcloudConfigured}
                  apiUrl={apiUrl}
                />
              </>
            )}
          </div>

          <div className="studio-actions studio-mt-lg">
            <Button onClick={save} disabled={isPending || !title.trim()} variant="primary">
              <ButtonIcon name="save" />
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button onClick={() => setOpen(false)} variant="ghost">
              Cancel
            </Button>
          </div>
          {error && <p className="studio-notice studio-notice--error">{error}</p>}

          <div className="studio-danger-zone studio-mt-lg">
            {!confirmDelete ? (
              <Button onClick={() => setConfirmDelete(true)} variant="ghost" size="sm">
                <ButtonIcon name="trash" />
                Delete recording
              </Button>
            ) : (
              <div className="studio-row studio-row--wrap studio-gap-xs">
                <span className="studio-text-sm">
                  Delete &ldquo;{item.title}&rdquo; permanently?
                </span>
                <Button onClick={() => setConfirmDelete(false)} variant="ghost" size="sm">
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  variant="danger"
                  size="sm"
                >
                  <ButtonIcon name="trash" />
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
