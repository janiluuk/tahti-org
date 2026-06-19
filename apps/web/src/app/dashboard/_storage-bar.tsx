// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export function formatStorageBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

/** Archive track count + optional bytes — primary label is always track count. */
export function StorageBar({
  trackCount,
  usedBytes,
  softTargetBytes,
  showSoftTarget,
}: {
  trackCount: number
  usedBytes: number
  softTargetBytes?: number
  showSoftTarget: boolean
}) {
  const trackLabel = `${trackCount} track${trackCount === 1 ? '' : 's'}`
  const showBytes = trackCount > 0 && usedBytes > 0

  if (!showSoftTarget || softTargetBytes == null) {
    return (
      <div className="studio-storage">
        <div className="studio-storage-header">
          <span className="studio-stat-box-title">Storage</span>
          <span className="studio-text-sm studio-text-muted-sm">
            {trackCount > 0 ? (
              <>
                {trackLabel}
                {showBytes ? (
                  <>
                    {' '}
                    <small className="studio-storage-bytes">
                      {formatStorageBytes(usedBytes)} used
                    </small>
                  </>
                ) : null}
              </>
            ) : (
              '0 tracks'
            )}
          </span>
        </div>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((usedBytes / softTargetBytes) * 100))
  const isNearLimit = pct >= 80

  return (
    <div className="studio-storage">
      <div className="studio-storage-header">
        <span className="studio-stat-box-title">Storage</span>
        <span
          className={`studio-text-sm${isNearLimit ? ' studio-text-error' : ' studio-text-muted-sm'}`}
        >
          {trackCount > 0 ? (
            <>
              {trackLabel}
              {showBytes ? (
                <>
                  {' '}
                  <small className="studio-storage-bytes">
                    {formatStorageBytes(usedBytes)} used · soft target{' '}
                    {formatStorageBytes(softTargetBytes)}
                  </small>
                </>
              ) : null}
            </>
          ) : (
            '0 tracks'
          )}
        </span>
      </div>
      <div className="studio-storage-track">
        <div
          className={`studio-storage-fill${isNearLimit ? ' studio-storage-fill--warn' : ''}`}
          style={{ ['--studio-storage-pct' as string]: `${pct}%` }}
        />
      </div>
      {isNearLimit && (
        <p className="studio-text-muted-sm studio-mt-sm studio-m-0">
          You&apos;ve passed the soft target — that&apos;s fine. We track usage, not hard limits.
        </p>
      )}
    </div>
  )
}
