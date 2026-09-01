// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { AvatarTile, RankBadge, SafePlainText } from '@tahti/ui'
import type { PlayerTrack } from '@/contexts/player-context'
import { ArchiveItemPlayback } from '@/components/archive-item-playback'
import { LibraryBrowser } from '@/components/library/library-browser'
import { ReportButton } from '@/components/report-button'
import { TrackCommentsToggle } from '@/components/track-comments-toggle'
import { TracklistView } from '@/components/tracklist/tracklist-view'
import { ArchiveItemGallery } from './archive-item-gallery'
import { ArchiveVideoBackdrop, resolveArchiveBackground } from './archive-item-backdrop'
import type { ArchiveItem } from './page'

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/**
 * LibraryBrowser's getTitle/getCreatedAt/children props are all functions —
 * illegal to pass across the Server → Client boundary (RSC serialization).
 * The parent page.tsx is a Server Component, so this closure-owning wrapper
 * is required; it only receives plain serializable data as props.
 */
export function ArchiveListSection({
  items,
  ranks,
  slug,
  artistUsername,
  colorSchemeJson,
  isLoggedIn,
  archiveQueue,
}: {
  items: ArchiveItem[]
  ranks: Record<string, number>
  slug: string
  artistUsername: string
  colorSchemeJson?: string | null
  isLoggedIn: boolean
  archiveQueue: PlayerTrack[]
}) {
  return (
    <LibraryBrowser
      items={items}
      getTitle={(item) => item.title}
      getCreatedAt={(item) => item.createdAt}
      searchPlaceholder="Search sounds…"
      emptyMessage="No archive items yet."
      noMatchMessage="No sounds match."
      showStatusFilters={false}
    >
      {(visible) => (
        <ul className="ch-archive-list">
          {visible.map((item) => {
            const { cssImageUrl, videoEmbedUrl } = resolveArchiveBackground(item.backgroundUrl)
            return (
              <li
                key={item.id}
                id={`archive-item-${item.id}`}
                className={`ch-archive-item${cssImageUrl ? ' ch-archive-item--bg' : ''}`}
                style={cssImageUrl ? { ['--ch-item-bg' as string]: cssImageUrl } : undefined}
              >
                {videoEmbedUrl && <ArchiveVideoBackdrop embedUrl={videoEmbedUrl} />}
                <div className="ch-archive-item-header">
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    {item.bannerUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.bannerUrl} alt="" className="ch-archive-item-thumb" />
                    ) : (
                      <AvatarTile size="xs" name={item.title} />
                    )}
                    {ranks[item.id] && <RankBadge rank={ranks[item.id]!} />}
                  </span>
                  <div className="ch-archive-item-meta">
                    <div className="ch-archive-item-meta-main">
                      <div className="ch-archive-item-title">{item.title}</div>
                      {item.artistName ? (
                        <div className="ch-archive-item-credit">
                          <span>{item.artistName}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="ch-archive-item-date">
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                      })}
                      {item.durationSec != null && <> · {fmtDuration(item.durationSec)}</>}
                    </div>
                  </div>
                </div>
                {(() => {
                  const hasCredits = Boolean(item.credits && item.credits.length > 0)
                  const hasGallery = Boolean(item.slideshowUrls && item.slideshowUrls.length > 0)
                  const hasDesc = Boolean(item.description)
                  const hasCommentary = Boolean(item.commentary)
                  const hasTracklist = Boolean(item.tracklist && item.tracklist.length > 0)
                  const hasDetails =
                    hasCredits || hasGallery || hasDesc || hasCommentary || hasTracklist
                  if (!hasDetails) return null
                  return (
                    <details className="ch-archive-item-details">
                      <summary className="ch-archive-item-details__summary">Details</summary>
                      <div className="ch-archive-item-details__body">
                        {hasCredits ? (
                          <div className="ch-archive-item-credit ch-archive-item-credit--roles">
                            {item.credits!.map((c, i) => (
                              <span key={`${c.role}-${c.name}-${i}`}>
                                {i > 0 ? ' · ' : null}
                                {c.role}:{' '}
                                {c.artistUsername ? (
                                  <a
                                    href={`/u/${c.artistUsername}`}
                                    className="ch-archive-item-credit__link"
                                  >
                                    {c.name}
                                  </a>
                                ) : (
                                  c.name
                                )}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {hasGallery ? (
                          <ArchiveItemGallery
                            itemId={item.id}
                            images={item.slideshowUrls!}
                            galleryMode={item.galleryMode ?? 'NONE'}
                            audioReactive={Boolean(item.galleryAudioReactive)}
                          />
                        ) : null}
                        {hasDesc ? (
                          <SafePlainText
                            text={item.description!}
                            className="ch-archive-item-desc"
                          />
                        ) : null}
                        {hasCommentary ? (
                          <SafePlainText
                            text={item.commentary!}
                            className="ch-archive-item-commentary"
                          />
                        ) : null}
                        {hasTracklist ? <TracklistView entries={item.tracklist!} /> : null}
                      </div>
                    </details>
                  )
                })()}
                {item.audioUrl ? (
                  <ArchiveItemPlayback
                    channelSlug={slug}
                    artistUsername={artistUsername}
                    artistCredit={item.artistName}
                    item={{ ...item, audioUrl: item.audioUrl }}
                    colorSchemeJson={colorSchemeJson}
                    isLoggedIn={isLoggedIn}
                    queue={archiveQueue}
                  />
                ) : (
                  <>
                    <TrackCommentsToggle
                      archiveItemId={item.id}
                      isLoggedIn={isLoggedIn}
                      commentCount={item.commentCount ?? 0}
                    />
                    <ReportButton targetType="ARCHIVE_ITEM" targetId={item.id} />
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </LibraryBrowser>
  )
}
