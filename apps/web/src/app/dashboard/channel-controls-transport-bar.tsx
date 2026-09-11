'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Button } from '@tahti/ui'
import { StopResumeIcon, TransportIcon } from './channel-controls-icons'
import type { Programme } from './channel-controls-types'

export function ChannelControlsTransportBar({
  programme,
  pending,
  onTransport,
  onToggleChannel,
}: {
  programme: Programme | null
  pending: string | null
  onTransport: (action: 'previous' | 'skip') => void
  onToggleChannel: () => void
}) {
  return (
    <div className="db-channel-controls__transport" role="group" aria-label="Channel playback">
      <Button
        type="button"
        variant="secondary"
        aria-label="Previous track"
        title="Previous track"
        disabled={pending !== null}
        onClick={() => onTransport('previous')}
      >
        <TransportIcon direction="previous" />
      </Button>
      <Button
        type="button"
        variant={programme?.fallbackEnabled ? 'danger' : 'primary'}
        aria-label={programme?.fallbackEnabled ? 'Stop channel' : 'Start channel'}
        title={programme?.fallbackEnabled ? 'Stop channel' : 'Start channel'}
        disabled={!programme || pending !== null}
        onClick={onToggleChannel}
      >
        <StopResumeIcon playing={Boolean(programme?.fallbackEnabled)} />
      </Button>
      <Button
        type="button"
        variant="secondary"
        aria-label="Next track"
        title="Next track"
        disabled={pending !== null}
        onClick={() => onTransport('skip')}
      >
        <TransportIcon direction="next" />
      </Button>
    </div>
  )
}
