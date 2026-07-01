// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import NextLink from 'next/link'
import { fetchRecentBroadcasts, fetchStorageStatus } from './upload-actions'
import { UploadEntryClient } from './_upload-entry-client'
import { PageShell } from '@tahti/ui'
import { StudioHeaderActions } from '../_studio-header-actions'
import { getDashboardUser } from '@/lib/dashboard-session'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function UploadPage() {
  const [broadcasts, storage, user] = await Promise.all([
    fetchRecentBroadcasts(5),
    fetchStorageStatus(),
    getDashboardUser(),
  ])

  const unpublishedBroadcasts = broadcasts.filter(
    (b) =>
      !b.archiveItemId || b.archiveItemStatus === 'PENDING' || b.archiveItemStatus === 'PROCESSING',
  )

  const usedPct =
    storage?.showSoftTarget && storage.softTargetBytes
      ? Math.min(100, Math.round((storage.usedBytes / storage.softTargetBytes) * 100))
      : 0

  return (
    <PageShell size="md">
      <div className="upload-entry">
        <div className="upload-entry__topbar studio-page-header">
          <div>
            <h1 className="upload-entry__title studio-page-title">Add content</h1>
            {storage && (
              <div className="upload-entry__storage">
                {storage.showSoftTarget && storage.softTargetBytes ? (
                  <>
                    <div className="upload-entry__storage-bar">
                      <div
                        className={`upload-entry__storage-fill${usedPct > 80 ? ' upload-entry__storage-fill--warn' : ''}`}
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                    <span className="upload-entry__storage-label">
                      {storage.tier.toLowerCase()} · soft target{' '}
                      {formatBytes(storage.softTargetBytes)}
                    </span>
                  </>
                ) : null}
                {storage.showSoftTarget && (
                  <NextLink
                    href="/dashboard/settings/account"
                    className="upload-entry__upgrade-link"
                  >
                    View membership →
                  </NextLink>
                )}
              </div>
            )}
          </div>
          <div className="studio-page-header__actions">
            <StudioHeaderActions
              hasChannel={Boolean(user?.channel)}
              isLive={user?.channel?.state === 'LIVE'}
              channelSlug={user?.channel?.slug}
              showBack
            />
          </div>
        </div>

        {/* ── Main tiles ── */}
        <div className="upload-entry__tiles">
          {/* Upload drop zone (client — needs file APIs) */}
          <UploadEntryClient />

          {/* Publish from broadcast */}
          <div className="upload-entry__tile upload-entry__tile--broadcast">
            <h2 className="upload-entry__tile-title">Publish from broadcast</h2>
            {unpublishedBroadcasts.length === 0 ? (
              <p className="upload-entry__broadcast-empty">
                No recent unpublished broadcasts.{' '}
                <NextLink href="/dashboard/broadcast" className="studio-link">
                  Go live to record one.
                </NextLink>
              </p>
            ) : (
              <>
                <ul className="upload-entry__broadcast-list">
                  {unpublishedBroadcasts.slice(0, 3).map((b) => (
                    <li key={b.id} className="upload-entry__broadcast-row">
                      <div className="upload-entry__broadcast-info">
                        <span className="upload-entry__broadcast-name">
                          {b.archiveItemTitle ?? `Broadcast ${formatDate(b.startedAt)}`}
                        </span>
                        <span className="upload-entry__broadcast-meta">
                          {formatDate(b.startedAt)}
                          {b.durationSec ? ` · ${formatDuration(b.durationSec)}` : ''}
                        </span>
                      </div>
                      <NextLink
                        href={
                          b.archiveItemId
                            ? `/dashboard/archive/${b.archiveItemId}/editor`
                            : `/dashboard/upload/from-broadcast?id=${b.id}`
                        }
                        className="ui-btn ui-btn--ghost ui-btn--sm"
                      >
                        {b.archiveItemId ? 'Polish & publish' : 'Edit & publish'} →
                      </NextLink>
                    </li>
                  ))}
                </ul>
                {unpublishedBroadcasts.length > 3 && (
                  <NextLink
                    href="/dashboard/upload/from-broadcast"
                    className="upload-entry__all-link"
                  >
                    All broadcasts ({unpublishedBroadcasts.length}) →
                  </NextLink>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Other ways ── */}
        <div className="upload-entry__other-header">Other ways to add content</div>
        <div className="upload-entry__other-row">
          <NextLink href="/dashboard/upload/import/bandcamp" className="upload-entry__other-card">
            <span className="upload-entry__other-icon">◎</span>
            <span className="upload-entry__other-name">Bandcamp</span>
            <span className="upload-entry__other-desc">
              Import your own releases with FLAC masters
            </span>
          </NextLink>
          <NextLink href="/dashboard/upload/import/soundcloud" className="upload-entry__other-card">
            <span className="upload-entry__other-icon">◉</span>
            <span className="upload-entry__other-name">SoundCloud</span>
            <span className="upload-entry__other-desc">Import downloadable tracks you own</span>
          </NextLink>
          <NextLink
            href="/dashboard/upload/import/google-drive"
            className="upload-entry__other-card"
          >
            <span className="upload-entry__other-icon">▣</span>
            <span className="upload-entry__other-name">Google Drive</span>
            <span className="upload-entry__other-desc">
              Pick audio from your cloud storage — no local download
            </span>
          </NextLink>
          <NextLink href="/dashboard/upload/import/url" className="upload-entry__other-card">
            <span className="upload-entry__other-icon">⊞</span>
            <span className="upload-entry__other-name">Paste URL</span>
            <span className="upload-entry__other-desc">
              Spotify, Apple Music, YouTube — embed-only smart link
            </span>
          </NextLink>
          <NextLink
            href="/dashboard/upload/import/mixcloud-rescue"
            className="upload-entry__other-card"
          >
            <span className="upload-entry__other-icon">◐</span>
            <span className="upload-entry__other-name">Rescue from Mixcloud</span>
            <span className="upload-entry__other-desc">
              Re-upload your own backup of a mix — second-best, but better than nothing
            </span>
          </NextLink>
        </div>

        {/* ── Collections link ── */}
        <div className="upload-entry__collections-link">
          <NextLink href="/dashboard/collections" className="studio-link">
            Organise into collections →
          </NextLink>
        </div>
      </div>
    </PageShell>
  )
}
