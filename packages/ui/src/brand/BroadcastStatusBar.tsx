// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'
import { BrandButton } from './Button'

export type BroadcastState = 'live' | 'starting' | 'ending' | 'offline'

export interface BroadcastStatusBarProps {
  state: BroadcastState
  listeners?: number
  /** Elapsed broadcast time, e.g. "24:37". */
  elapsed?: string
  showName?: string
  /** Shown below the live label when `state` is live-ish. */
  meta?: React.ReactNode
  /** Shown when `state="offline"`. */
  offlineMessage?: string
  /** Right-side action slot (e.g. End Broadcast button). */
  action?: React.ReactNode
  /** Convenience: renders warn BrandButton when live and no custom action. */
  onEnd?: () => void
  endLabel?: string
  endDisabled?: boolean
  className?: string
}

function liveMeta(listeners?: number, elapsed?: string, showName?: string): string {
  const parts: string[] = []
  if (typeof listeners === 'number') {
    parts.push(`${listeners} listener${listeners === 1 ? '' : 's'}`)
  }
  if (elapsed) parts.push(`${elapsed} elapsed`)
  if (showName) parts.unshift(showName)
  return parts.join(' · ')
}

/** Dashboard / studio broadcast status strip — live green or offline card. */
export function BroadcastStatusBar({
  state,
  listeners,
  elapsed,
  showName,
  meta,
  offlineMessage = 'Channel offline',
  action,
  onEnd,
  endLabel = 'End Broadcast',
  endDisabled = false,
  className,
}: BroadcastStatusBarProps) {
  const isLive = state === 'live' || state === 'starting' || state === 'ending'

  const statusLabel =
    state === 'live'
      ? 'LIVE NOW'
      : state === 'starting'
        ? 'STARTING…'
        : state === 'ending'
          ? 'ENDING…'
          : null

  const endAction =
    action ??
    (isLive && onEnd ? (
      <BrandButton variant="warn" onClick={onEnd} disabled={endDisabled}>
        {endLabel}
      </BrandButton>
    ) : null)

  return (
    <div
      className={cn(
        'broadcast-status-bar',
        isLive ? 'broadcast-status-bar--live' : 'broadcast-status-bar--offline',
        className,
      )}
      role="status"
    >
      <div className="broadcast-status-bar__main">
        {isLive ? (
          <>
            <div className="broadcast-status-bar__live">
              <span className="broadcast-status-bar__dot" aria-hidden />
              {statusLabel}
            </div>
            <div className="broadcast-status-bar__meta">
              {meta ?? liveMeta(listeners, elapsed, showName)}
            </div>
          </>
        ) : (
          <div className="broadcast-status-bar__offline">{offlineMessage}</div>
        )}
      </div>
      {endAction ? <div className="broadcast-status-bar__action">{endAction}</div> : null}
    </div>
  )
}
