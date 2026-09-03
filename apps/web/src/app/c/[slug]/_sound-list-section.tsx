// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { AvatarTile, RankBadge, SafePlainText } from '@tahti/ui'
import type { PlayerTrack } from '@/contexts/player-context'
import { SoundItemPlayback } from '@/components/sound-item-playback'
import { LibraryBrowser } from '@/components/library/library-browser'
import { ReportButton } from '@/components/report-button'
import { TrackCommentsToggle } from '@/components/track-comments-toggle'
import { TracklistView } from '@/components/tracklist/tracklist-view'
import { SoundItemGallery } from './sound-item-gallery'
import { SoundVideoBackdrop, resolveSoundBackground } from './sound-item-backdrop'
import type { SoundItem } from './page'

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
export function SoundListSection({
  items,
  ranks,
  slug,
  artistUsername,
  colorSchemeJson,
  isLoggedIn,
  soundQueue,
}: {
  items: SoundItem[]
  ranks: Record<string, number>
  slug: string
  artistUsername: string
  colorSchemeJson?: string | null
  isLoggedIn: boolean
  soundQueue: PlayerTrack[]
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
        <ul className="ch-sound-list">
          {visible.map((item) => {
            const { cssImageUrl, videoEmbedUrl } = resolveSoundBackground(item.backgroundUrl)
            return (
              <li
                key={item.id}
                id={`archive-item-${item.id}`}
                className={`ch-sound-item${cssImageUrl ? ' ch-sound-item--bg' : ''}`}
                style={cssImageUrl ? { ['--ch-item-bg' as string]: cssImageUrl } : undefined}
              >
                {videoEmbedUrl && <SoundVideoBackdrop embedUrl={videoEmbedUrl} />}
                <div className="ch-sound-item-header">
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    {item.bannerUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.bannerUrl} alt="" className="ch-sound-item-thumb" />
                    ) : (
                      <AvatarTile size="xs" name={item.title} />
                    )}
                    {ranks[item.id] && <RankBadge rank={ranks[item.id]!} />}
                  </span>
                  <div className="ch-sound-item-meta">
                    <div className="ch-sound-item-meta-main">
                      <div className="ch-sound-item-title">{item.title}</div>
                      {item.artistName ? (
                        <div className="ch-sound-item-credit">
                          <span>{item.artistName}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="ch-sound-item-date">
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
                    <details className="ch-sound-item-details">
                      <summary className="ch-sound-item-details__summary">Details</summary>
                      <div className="ch-sound-item-details__body">
                        {hasCredits ? (
                          <div className="ch-sound-item-credit ch-sound-item-credit--roles">
                            {item.credits!.map((c, i) => (
                              <span key={`${c.role}-${c.name}-${i}`}>
                                {i > 0 ? ' · ' : null}
                                {c.role}:{' '}
                                {c.artistUsername ? (
                                  <a
                                    href={`/u/${c.artistUsername}`}
                                    className="ch-sound-item-credit__link"
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
                          <SoundItemGallery
                            itemId={item.id}
                            images={item.slideshowUrls!}
                            galleryMode={item.galleryMode ?? 'NONE'}
                            audioReactive={Boolean(item.galleryAudioReactive)}
                          />
                        ) : null}
                        {hasDesc ? (
                          <SafePlainText text={item.description!} className="ch-sound-item-desc" />
                        ) : null}
                        {hasCommentary ? (
                          <SafePlainText
                            text={item.commentary!}
                            className="ch-sound-item-commentary"
                          />
                        ) : null}
                        {hasTracklist ? <TracklistView entries={item.tracklist!} /> : null}
                      </div>
                    </details>
                  )
                })()}
                {item.audioUrl ? (
                  <SoundItemPlayback
                    channelSlug={slug}
                    artistUsername={artistUsername}
                    artistCredit={item.artistName}
                    item={{ ...item, audioUrl: item.audioUrl }}
                    colorSchemeJson={colorSchemeJson}
                    isLoggedIn={isLoggedIn}
                    queue={soundQueue}
                  />
                ) : (
                  <>
                    <TrackCommentsToggle
                      soundId={item.id}
                      isLoggedIn={isLoggedIn}
                      commentCount={item.commentCount ?? 0}
                    />
                    <ReportButton targetType="SOUND_ITEM" targetId={item.id} />
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
