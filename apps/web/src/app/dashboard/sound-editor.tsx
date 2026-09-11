// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { ButtonIcon, Button } from '@tahti/ui'
import { SoundItemPlayback, HearthisSoundItemPlayback } from '@/components/sound-item-playback'
import { HearthisEmbedRow } from '../u/[username]/c/[slug]/_hearthis-embed-row'
import { MixcloudEmbedRow } from '../u/[username]/c/[slug]/_mixcloud-embed-row'
import { SpotifyEmbedRow } from '../u/[username]/c/[slug]/_spotify-embed-row'
import { LoveButton } from '@/components/love-button'
import { RepostButton } from '@/components/repost-button'
import { TrackCommentsToggle } from '@/components/track-comments-toggle'
import { SoundDownloadButton } from '@/components/sound-download-button'
import type { PlayerTrack } from '@/contexts/player-context'
import { deleteSoundItem, updateSoundMetadata } from './sound-actions'
import {
  SoundBasicsFields,
  SoundTracklistField,
  SoundVisualsFields,
  SoundSharingFields,
  SoundAdvancedFields,
  metadataFormToPayload,
  metadataFromApi,
  type SoundMetadataFormState,
} from './sound-metadata-fields'
import { SoundVersionPanel } from './sound-version-panel'
import { SoundDownloadPanel } from './sound-download-panel'
import { SoundGateStats } from './sound-gate-stats'
import { SoundMixcloudUpload } from './sound-mixcloud'
import { SoundHearthisExportPanel } from './sound-hearthis-export-panel'
import SoundVisualPanel from './sound-visual-panel'
import ArchiveAccessPanel from './archive-access-panel'
import { shouldShowTracklist, shouldShowVenueLocation } from './sound-editor-visibility'
import { RowToolsActions } from './sound-editor-row-tools'

type EditorTab = 'basics' | 'tracklist' | 'audio' | 'visuals' | 'access' | 'sharing' | 'advanced'

const EDITOR_TABS: { id: EditorTab; label: string; icon: string }[] = [
  { id: 'basics', label: 'Basics', icon: '📝' },
  { id: 'tracklist', label: 'Tracklist', icon: '🎼' },
  { id: 'audio', label: 'Audio', icon: '🎚️' },
  { id: 'visuals', label: 'Cover & visuals', icon: '🖼️' },
  { id: 'access', label: 'Access', icon: '🔒' },
  { id: 'sharing', label: 'Sharing', icon: '🔗' },
  { id: 'advanced', label: 'Advanced', icon: '⚙️' },
]

export default function SoundEditor({
  item,
  mixcloudConnected,
  mixcloudConfigured,
  apiUrl,
  channelSlug,
  artistUsername,
  play,
  queue,
}: {
  item: Record<string, unknown> & {
    id: string
    title: string
    status: string
    streamingCopyStatus?: string
  }
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
  const [meta, setMeta] = useState<SoundMetadataFormState>(() => metadataFromApi(item))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updateSoundMetadata(item.id, {
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
    const res = await deleteSoundItem(item.id)
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
      const res = await updateSoundMetadata(item.id, { pinned: next })
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
        await updateSoundMetadata(item.id, { isFallback: false })
        setInRotation(false)
        setRotationPending(false)
        router.refresh()
      })
      return
    }
    setRotationPending(true)
    setRotationError(null)
    startTransition(async () => {
      const res = await updateSoundMetadata(item.id, { isFallback: true })
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
      const res = await updateSoundMetadata(item.id, {
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
        <div className="sound-list__playback-row" data-tahti-ui="brand">
          <SoundItemPlayback
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
      ) : isReady && isPublic && !open && play?.embedUri && play.embedProvider === 'HEARTHIS' ? (
        <div className="sound-list__playback-row" data-tahti-ui="brand">
          <HearthisSoundItemPlayback
            id={item.id}
            title={item.title}
            artistName={play.artistName}
            embedUri={play.embedUri}
            queue={queue}
          />
          <div className="sound-list__row-actions">
            {channelSlug && (
              <>
                <LoveButton channelSlug={channelSlug} itemId={item.id} />
                <SoundDownloadButton
                  channelSlug={channelSlug}
                  artistUsername={artistUsername ?? ''}
                  itemId={item.id}
                  repostToDownload={Boolean(play.repostToDownload)}
                  followToDownload={Boolean(play.followToDownload)}
                  downloadCount={play.downloadCount ?? 0}
                />
                <RepostButton channelSlug={channelSlug} itemId={item.id} />
                <TrackCommentsToggle
                  soundId={item.id}
                  isLoggedIn
                  commentCount={play.commentCount ?? 0}
                />
              </>
            )}
            {rowActions}
          </div>
        </div>
      ) : isReady && isPublic && !open && play?.embedUri ? (
        <div className="sound-list__playback-row" data-tahti-ui="brand">
          <div className="sound-list__embed-row">
            {play.embedProvider === 'MIXCLOUD' ? (
              <MixcloudEmbedRow title={item.title} embedUri={play.embedUri} />
            ) : play.embedProvider === 'SPOTIFY' ? (
              <SpotifyEmbedRow title={item.title} embedUri={play.embedUri} />
            ) : (
              <HearthisEmbedRow title={item.title} embedUri={play.embedUri} />
            )}
          </div>
          <div className="sound-list__row-actions">
            {channelSlug && (
              <>
                <LoveButton channelSlug={channelSlug} itemId={item.id} />
                <SoundDownloadButton
                  channelSlug={channelSlug}
                  artistUsername={artistUsername ?? ''}
                  itemId={item.id}
                  repostToDownload={Boolean(play.repostToDownload)}
                  followToDownload={Boolean(play.followToDownload)}
                  downloadCount={play.downloadCount ?? 0}
                />
                <RepostButton channelSlug={channelSlug} itemId={item.id} />
                <TrackCommentsToggle
                  soundId={item.id}
                  isLoggedIn
                  commentCount={play.commentCount ?? 0}
                />
              </>
            )}
            {rowActions}
          </div>
        </div>
      ) : (
        <div className="studio-card-row">
          <div className="studio-stat-box-title">
            {item.title}
            {!isReady ? (
              <span className="studio-processing-badge">
                <ButtonIcon name="refresh" />
                Processing…
              </span>
            ) : item.streamingCopyStatus === 'PENDING' ||
              item.streamingCopyStatus === 'PROCESSING' ? (
              <span
                className="studio-processing-badge"
                title="Encoding a compressed copy for low-bandwidth listeners"
              >
                <ButtonIcon name="refresh" />
                Encoding streaming copy…
              </span>
            ) : null}
          </div>
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
                  href={`/dashboard/sounds/${item.id}/editor`}
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
              <SoundBasicsFields state={meta} onChange={setMeta} disabled={isPending} />
            )}
            {tab === 'tracklist' && (
              <SoundTracklistField state={meta} onChange={setMeta} disabled={isPending} />
            )}
            {tab === 'audio' && (
              <>
                <SoundVersionPanel
                  itemId={item.id}
                  itemStatus={item.status}
                  embedUri={item.embedUri as string | null | undefined}
                />
                <SoundDownloadPanel itemId={item.id} />
                {!item.embedUri && (
                  <NextLink
                    href={`/dashboard/sounds/${item.id}/editor`}
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
                <SoundVisualsFields
                  state={meta}
                  onChange={setMeta}
                  disabled={isPending}
                  itemId={item.id}
                />
                <SoundVisualPanel
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
            {tab === 'access' && (
              <ArchiveAccessPanel
                itemId={item.id}
                initial={{
                  accessMode: ((item.accessMode as string | undefined) ??
                    'FREE') as import('@tahti/shared').ArchiveItemAccessPatch['accessMode'],
                  purchaseTierId: (item.purchaseTierId as string | null | undefined) ?? null,
                }}
              />
            )}
            {tab === 'sharing' && (
              <>
                <SoundSharingFields
                  state={meta}
                  onChange={setMeta}
                  disabled={isPending}
                  itemId={item.id}
                />
                <SoundGateStats
                  itemId={item.id}
                  repostToDownload={meta.repostToDownload}
                  followToDownload={meta.followToDownload}
                />
              </>
            )}
            {tab === 'advanced' && (
              <>
                <SoundAdvancedFields
                  state={meta}
                  onChange={setMeta}
                  disabled={isPending}
                  detectedBpm={detectedBpm ?? null}
                  detectedKey={detectedKey ?? null}
                  showVenueLocation={showVenueLocation}
                />
                <SoundMixcloudUpload
                  itemId={item.id}
                  itemStatus={item.status}
                  mixcloudConnected={mixcloudConnected}
                  mixcloudConfigured={mixcloudConfigured}
                  apiUrl={apiUrl}
                />
                <SoundHearthisExportPanel
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
