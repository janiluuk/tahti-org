// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { fetchDownloadGateStats } from './archive-actions'

export function ArchiveGateStats({
  itemId,
  repostToDownload,
  followToDownload,
}: {
  itemId: string
  repostToDownload: boolean
  followToDownload: boolean
}) {
  const [stats, setStats] = useState<{
    artistFollowerCount: number
    repostAckCount: number
    blockedDownloadAttempts: number
    countedDownloadCount: number
  } | null>(null)

  useEffect(() => {
    if (!repostToDownload && !followToDownload) return
    void fetchDownloadGateStats(itemId).then((res) => {
      if (res.stats) setStats(res.stats)
    })
  }, [itemId, repostToDownload, followToDownload])

  if (!repostToDownload && !followToDownload) return null
  if (!stats) return null

  return (
    <div className="studio-gate-stats">
      <div className="studio-text-strong-sm studio-mb-sm">Download gate stats</div>
      {followToDownload && (
        <div>
          Artist followers: <strong>{stats.artistFollowerCount}</strong>
        </div>
      )}
      {repostToDownload && (
        <div>
          Repost acknowledgements (this track): <strong>{stats.repostAckCount}</strong>
        </div>
      )}
      {(repostToDownload || followToDownload) && stats.blockedDownloadAttempts > 0 && (
        <div>
          Blocked download attempts: <strong>{stats.blockedDownloadAttempts}</strong>
        </div>
      )}
      {(repostToDownload || followToDownload) && (
        <div>
          Counted downloads (14d): <strong>{stats.countedDownloadCount}</strong>
        </div>
      )}
    </div>
  )
}
