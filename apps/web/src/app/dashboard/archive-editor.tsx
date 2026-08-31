// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { ButtonIcon, Button } from '@tahti/ui'
import { ArchiveItemPlayback } from '@/components/archive-item-playback'
import { HearthisEmbedRow } from '../u/[username]/c/[slug]/_hearthis-embed-row'
import { MixcloudEmbedRow } from '../u/[username]/c/[slug]/_mixcloud-embed-row'
import { SpotifyEmbedRow } from '../u/[username]/c/[slug]/_spotify-embed-row'
import type { PlayerTrack } from '@/contexts/player-context'
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
import { ArchiveHearthisExportPanel } from './archive-hearthis-export-panel'
import ArchiveVisualPanel from './archive-visual-panel'
import { AddToPlaylistButton } from './_add-to-playlist-button'
import { shouldShowTracklist, shouldShowVenueLocation } from './archive-editor-visibility'

function IconPin({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2v4.2L5 9v1.5h6V9L8 6.2V2Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 10.5V14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function IconRotation({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13 5.5A5 5 0 1 0 13.8 9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M13 2v4h-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {active && <circle cx="8" cy="8" r="1.5" fill="currentColor" />}
    </svg>
  )
}

function IconInsights() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 13V7M8 13V3M13 13V9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconTools() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10.4 2.6a2.6 2.6 0 0 0-3.4 3.1L2.6 10.1a1.4 1.4 0 0 0 2 2l4.4-4.4a2.6 2.6 0 0 0 3.1-3.4l-1.7 1.7-1.4-1.4 1.7-1.7Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Pin / rotation / add-to-playlist stay one-click; edit-oriented actions
 * (details, audio editor, insights) group under this "Tools" disclosure so
 * the row's icon cluster doesn't sprawl. Rendered inline with the playback
 * row's own icons (love/queue/download/repost/comment/report) so management
 * and listening actions read as a single button row instead of two. */
function RowToolsActions({
  itemId,
  hasEmbed,
  pinned,
  pinPending,
  togglePin,
  inRotation,
  rotationPending,
  toggleRotation,
  onEditDetails,
}: {
  itemId: string
  hasEmbed: boolean
  pinned: boolean
  pinPending: boolean
  togglePin: () => void
  inRotation: boolean
  rotationPending: boolean
  toggleRotation: () => void
  onEditDetails: () => void
}) {
  return (
    <>
      <Button
        onClick={togglePin}
        disabled={pinPending}
        variant="ghost"
        size="sm"
        className="ui-btn--icon"
        title={pinned ? 'Unpin from Stage' : 'Pin to Stage'}
        aria-label={pinned ? 'Unpin from Stage' : 'Pin to Stage'}
      >
        <IconPin filled={pinned} />
      </Button>
      <Button
        onClick={toggleRotation}
        disabled={rotationPending}
        variant="ghost"
        size="sm"
        className="ui-btn--icon"
        title={inRotation ? 'Remove from rotation' : 'Add to rotation'}
        aria-label={inRotation ? 'Remove from rotation' : 'Add to rotation'}
      >
        <IconRotation active={inRotation} />
      </Button>
      <AddToPlaylistButton archiveItemId={itemId} variant="icon" />
      <details className="archive-list__tools">
        <summary
          className="ui-btn ui-btn--sm ui-btn--ghost ui-btn--icon"
          title="Tools"
          aria-label="Tools"
        >
          <IconTools />
        </summary>
        <div className="archive-list__tools-menu" role="menu">
          <button type="button" role="menuitem" onClick={onEditDetails}>
            <ButtonIcon name="edit" />
            Edit details
          </button>
          {!hasEmbed && (
            <NextLink href={`/dashboard/archive/${itemId}/editor`} role="menuitem">
              <ButtonIcon name="edit" />
              Audio editor
            </NextLink>
          )}
          <NextLink href={`/dashboard/insights/archive/${itemId}`} role="menuitem">
            <IconInsights />
            Insights
          </NextLink>
        </div>
      </details>
    </>
  )
}

type EditorTab = 'basics' | 'tracklist' | 'audio' | 'visuals' | 'sharing' | 'advanced'

const EDITOR_TABS: { id: EditorTab; label: string; icon: string }[] = [
  { id: 'basics', label: 'Basics', icon: '📝' },
  { id: 'tracklist', label: 'Tracklist', icon: '🎼' },
  { id: 'audio', label: 'Audio', icon: '🎚️' },
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
  artistUsername,
  play,
  queue,
}: {
  item: Record<string, unknown> & { id: string; title: string; status: string }
  mixcloudConnected: boolean
  mixcloudConfigured: boolean
  apiUrl: string
  channelSlug?: string | null
  artistUsername?: string
  /** Playable/embed metadata for this item — undefined for drafts, which
   * aren't published (and so aren't in the public /items feed this comes
   * from) and fall back to the plain title+status row below. */
  play?: {
    audioUrl: string | null
    artistName: string | null
    embedProvider: string | null
    embedUri: string | null
    bannerUrl: string | null
    peaks: number[] | null
    visualPreset: string | null
    accentColor: string | null
    repostToDownload: boolean
    followToDownload: boolean
    commentCount: number
    downloadCount: number
  }
  queue?: PlayerTrack[]
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
  const showTracklist = shouldShowTracklist(
    meta.contentType,
    item.durationSec as number | null | undefined,
  )
  const showVenueLocation = shouldShowVenueLocation(
    meta.contentType,
    item.source as string | null | undefined,
  )
  const visibleTabs = useMemo(
    () => EDITOR_TABS.filter((editorTab) => editorTab.id !== 'tracklist' || showTracklist),
    [showTracklist],
  )

  useEffect(() => {
    if (!visibleTabs.some((editorTab) => editorTab.id === tab)) setTab('basics')
  }, [tab, visibleTabs])

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

  const hasEmbed = Boolean(item.embedUri)
  const rowActions = !open && (
    <RowToolsActions
      itemId={item.id}
      hasEmbed={hasEmbed}
      pinned={pinned}
      pinPending={pinPending}
      togglePin={togglePin}
      inRotation={inRotation}
      rotationPending={rotationPending}
      toggleRotation={toggleRotation}
      onEditDetails={() => setOpen(true)}
    />
  )

  return (
    <div className={`studio-item-row--list${open ? ' studio-item-row--list--active' : ''}`}>
      {isReady && isPublic && !open && play?.audioUrl && channelSlug ? (
        <div className="archive-list__playback-row" data-tahti-ui="brand">
          <ArchiveItemPlayback
            channelSlug={channelSlug}
            artistUsername={artistUsername ?? ''}
            artistCredit={play.artistName}
            item={{
              id: item.id,
              title: item.title,
              audioUrl: play.audioUrl,
              bannerUrl: play.bannerUrl,
              peaks: play.peaks,
              visualPreset: play.visualPreset,
              repostToDownload: play.repostToDownload,
              followToDownload: play.followToDownload,
              commentCount: play.commentCount,
              downloadCount: play.downloadCount,
              accentColor: play.accentColor,
            }}
            isLoggedIn
            queue={queue}
            titleOverlay={{ title: item.title, subtitle: play.artistName }}
            extraControls={rowActions}
          />
        </div>
      ) : isReady && isPublic && !open && play?.embedUri ? (
        <div className="archive-list__playback-row">
          <div className="archive-list__embed-row">
            {play.embedProvider === 'MIXCLOUD' ? (
              <MixcloudEmbedRow title={item.title} embedUri={play.embedUri} />
            ) : play.embedProvider === 'SPOTIFY' ? (
              <SpotifyEmbedRow title={item.title} embedUri={play.embedUri} />
            ) : (
              <HearthisEmbedRow title={item.title} embedUri={play.embedUri} />
            )}
          </div>
          <div className="archive-list__row-actions">{rowActions}</div>
        </div>
      ) : (
        <div className="studio-card-row">
          <div className="studio-stat-box-title">{item.title}</div>
          {open ? (
            <Button onClick={() => setOpen(false)} variant="ghost" size="sm">
              Close
            </Button>
          ) : isReady && isPublic ? (
            <div className="studio-row-actions studio-row-actions--icons">{rowActions}</div>
          ) : isReady ? (
            <div className="studio-row-actions">
              {!hasEmbed && (
                <NextLink
                  href={`/dashboard/archive/${item.id}/editor`}
                  className="ui-btn ui-btn--sm ui-btn--ghost"
                >
                  <ButtonIcon name="edit" />
                  Audio editor
                </NextLink>
              )}
              <Button onClick={() => setOpen(true)} variant="primary" size="sm">
                <ButtonIcon name="send" />
                Polish &amp; publish →
              </Button>
            </div>
          ) : (
            <Button onClick={() => setOpen(true)} variant="ghost" size="sm">
              Edit metadata
            </Button>
          )}
        </div>
      )}

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
            {visibleTabs.map((t) => (
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
            {tab === 'audio' && (
              <>
                <ArchiveVersionPanel
                  itemId={item.id}
                  itemStatus={item.status}
                  embedUri={item.embedUri as string | null | undefined}
                />
                <ArchiveDownloadPanel itemId={item.id} />
                {!item.embedUri && (
                  <NextLink
                    href={`/dashboard/archive/${item.id}/editor`}
                    className="ui-btn ui-btn--ghost ui-btn--sm studio-mt-md"
                  >
                    <ButtonIcon name="edit" />
                    Open audio editor
                  </NextLink>
                )}
              </>
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
                  showVenueLocation={showVenueLocation}
                />
                <ArchiveMixcloudUpload
                  itemId={item.id}
                  itemStatus={item.status}
                  mixcloudConnected={mixcloudConnected}
                  mixcloudConfigured={mixcloudConfigured}
                  apiUrl={apiUrl}
                />
                <ArchiveHearthisExportPanel
                  itemId={item.id}
                  initialStatus={item.hearthisExportStatus as string | null | undefined}
                  initialRemoteId={item.hearthisExportId as string | null | undefined}
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
