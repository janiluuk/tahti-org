// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Alert, Panel, ProgressBar } from '@tahti/ui'

// Separate from the free-tier 500MB quota itself — this is a heads-up
// banner for any tier once usage gets large, per explicit request.
const HEAVY_USAGE_ALERT_BYTES = 5 * 1024 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export default function StoragePanel({
  quotaBytes,
  usedBytes,
}: {
  quotaBytes: number
  usedBytes: number
}) {
  const percent = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0
  const overQuota = usedBytes > quotaBytes
  const heavyUsage = usedBytes > HEAVY_USAGE_ALERT_BYTES

  return (
    <Panel
      title="Storage"
      headerTight
      description="Your lossless masters are mirrored long-term to Tahti's storage. Streaming/preview copies don't count against this."
    >
      <ProgressBar
        label={`${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)} used`}
        amount={`${Math.min(100, Math.round(percent))}%`}
        percent={percent}
        color={overQuota ? 'cyan' : 'green'}
      />

      {overQuota && (
        <Alert variant="warning" className="studio-mt-sm">
          You&apos;re over your storage quota. New lossless uploads may be rejected until you free
          up space or upgrade.
        </Alert>
      )}

      {!overQuota && heavyUsage && (
        <Alert variant="info" className="studio-mt-sm">
          You&apos;re using a lot of storage ({formatBytes(usedBytes)}). Just a heads up —
          you&apos;re still within quota.
        </Alert>
      )}
    </Panel>
  )
}
