// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Button, SortableList } from '@tahti/ui'
import type { AddonInstallView, ChannelBlockView } from '@tahti/shared'
import { channelBlockSummary } from '@/lib/channel-block-summary'

const WIDTH_OPTIONS: Array<{ id: 'FULL' | 'HALF' | 'THIRD'; label: string }> = [
  { id: 'FULL', label: 'Full' },
  { id: 'HALF', label: 'Half' },
  { id: 'THIRD', label: 'Third' },
]

export interface ChannelBlockListProps {
  blocks: ChannelBlockView[]
  addonInstalls: AddonInstallView[]
  pendingId: string | null
  onWidthChange: (id: string, width: 'FULL' | 'HALF' | 'THIRD') => void
  onReorder: (next: ChannelBlockView[]) => void
  onRemove: (id: string) => void
}

/** Same shape as AddonInstalledList: drag to reorder, act immediately (no
 * separate Save step) -- width and position changes each take effect as
 * soon as they're made. */
export function ChannelBlockList({
  blocks,
  addonInstalls,
  pendingId,
  onWidthChange,
  onReorder,
  onRemove,
}: ChannelBlockListProps) {
  if (blocks.length === 0) {
    return <p className="studio-empty">No blocks yet — add a logo or an add-on below.</p>
  }

  return (
    <SortableList
      as="div"
      className="channel-block-list"
      items={blocks}
      itemId={(block) => block.id}
      onReorder={onReorder}
      renderItem={(block, _index, sortable) => {
        const isPending = pendingId === block.id || pendingId === 'reorder'
        return (
          <div
            ref={sortable.ref}
            className={`ui-panel channel-block-row${sortable.isDragging ? ' is-dragging' : ''}`}
          >
            <div className="studio-row studio-row--start">
              <button
                ref={sortable.handleRef}
                type="button"
                className="channel-block-row__handle"
                aria-label={`Reorder ${block.type.toLowerCase()} block`}
                disabled={isPending}
              >
                ⠿
              </button>
              <div className="studio-flex-1">
                <div className="studio-row studio-gap-xs">
                  <strong>{block.type === 'LOGO' ? 'Logo' : 'Add-on'}</strong>
                </div>
                <p className="studio-text-muted-sm studio-mt-xs">
                  {channelBlockSummary(block, addonInstalls)}
                </p>
              </div>
              <div className="studio-row studio-gap-xs" style={{ flexShrink: 0 }}>
                {WIDTH_OPTIONS.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={block.width === option.id ? 'primary' : 'secondary'}
                    disabled={isPending}
                    onClick={() => onWidthChange(block.id, option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  onClick={() => onRemove(block.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )
      }}
    />
  )
}
