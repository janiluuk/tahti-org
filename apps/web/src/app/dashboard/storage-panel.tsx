// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Alert, Panel, ProgressBar } from '@tahti/ui'

// docs/storage-policy.md: Tahti does not enforce per-user storage limits —
// "quotaBytes" here is a soft display target (default 500MB, same for every
// tier), not a cap. Nothing rejects uploads past it; these are the doc's own
// nudge thresholds (100% and 500% of soft target), tone "appreciative, not
// threatening."
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
  const overSoftTarget = usedBytes > quotaBytes
  const wayOverSoftTarget = quotaBytes > 0 && usedBytes > quotaBytes * 5

  return (
    <Panel
      title="Storage"
      headerTight
      description="Your lossless masters are mirrored long-term to Tahti's storage. Streaming/preview copies don't count against this. Tahti doesn't enforce storage limits — this is just a soft target to help you gauge usage."
    >
      <ProgressBar
        label={`${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)} used`}
        amount={`${Math.min(100, Math.round(percent))}%`}
        percent={Math.min(100, percent)}
        color="green"
      />

      {wayOverSoftTarget ? (
        <Alert variant="info" className="studio-mt-sm">
          You&apos;ve used {formatBytes(usedBytes)}. That&apos;s well above the soft target — and
          that&apos;s fine. Storage is shared, so we appreciate members keeping their archives lean
          where it&apos;s easy to.
        </Alert>
      ) : (
        overSoftTarget && (
          <Alert variant="info" className="studio-mt-sm">
            You&apos;ve used {formatBytes(usedBytes)}. That&apos;s more than most artists — and
            that&apos;s fine.
          </Alert>
        )
      )}
    </Panel>
  )
}
