// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { Button } from '@tahti/ui'
import type { AddonInstallView, ChannelBlockView } from '@tahti/shared'
import { listChannelAddonInstalls } from '@/app/dashboard/channel-addons-actions'
import { unblockedAddonInstalls } from '@/lib/channel-block-summary'
import {
  addChannelBlock,
  listChannelBlocks,
  patchChannelBlockAction,
  removeChannelBlock,
} from '@/app/dashboard/channel/channel-blocks-actions'
import { ChannelBlockList } from './channel-block-list'

/** Self-contained like ChannelAddonsPanel next to it in the same designer:
 * fetches its own data on mount rather than threading through
 * ChannelEditorData's already-large prop chain, since this section's data
 * (blocks + the addon installs available to reference) isn't needed by any
 * other section or the live preview draft. */
export function ChannelBlockManager() {
  const [blocks, setBlocks] = useState<ChannelBlockView[] | null>(null)
  const [addonInstalls, setAddonInstalls] = useState<AddonInstallView[]>([])
  const [selectedAddonInstallId, setSelectedAddonInstallId] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [blocksResult, installsResult] = await Promise.all([
        listChannelBlocks(),
        listChannelAddonInstalls(),
      ])
      if (blocksResult.error) setError(blocksResult.error)
      setBlocks(blocksResult.blocks)
      setAddonInstalls(installsResult.installs)
    })()
  }, [])

  async function handleAddLogo() {
    const assetUrl = logoUrl.trim()
    if (!assetUrl) return
    setError(null)
    setPendingId('add')
    const result = await addChannelBlock('LOGO', { assetUrl })
    setPendingId(null)
    if (result.error || !result.block) {
      setError(result.error ?? 'Failed to add block')
      return
    }
    setBlocks((prev) => [...(prev ?? []), result.block!])
    setLogoUrl('')
  }

  async function handleAddAddon() {
    if (!selectedAddonInstallId) return
    setError(null)
    setPendingId('add')
    const result = await addChannelBlock('ADDON', { addonInstallId: selectedAddonInstallId })
    setPendingId(null)
    if (result.error || !result.block) {
      setError(result.error ?? 'Failed to add block')
      return
    }
    setBlocks((prev) => [...(prev ?? []), result.block!])
    setSelectedAddonInstallId('')
  }

  async function handleWidthChange(id: string, width: 'FULL' | 'HALF' | 'THIRD') {
    setError(null)
    setPendingId(id)
    const result = await patchChannelBlockAction(id, { width })
    setPendingId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    setBlocks((prev) => prev?.map((b) => (b.id === id ? { ...b, width } : b)) ?? null)
  }

  async function handleReorder(next: ChannelBlockView[]) {
    const previous = blocks ?? []
    const reindexed = next.map((block, index) => ({ ...block, position: index }))
    setBlocks(reindexed)
    setError(null)
    setPendingId('reorder')
    const moved = reindexed.filter((block) => {
      const before = previous.find((b) => b.id === block.id)
      return before && before.position !== block.position
    })
    const results = await Promise.all(
      moved.map((block) => patchChannelBlockAction(block.id, { position: block.position })),
    )
    setPendingId(null)
    const failed = results.find((result) => result.error)
    if (failed) {
      setBlocks(previous)
      setError(failed.error ?? 'Failed to reorder')
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    setPendingId(id)
    const result = await removeChannelBlock(id)
    setPendingId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    setBlocks((prev) => prev?.filter((b) => b.id !== id) ?? null)
  }

  const unblockedInstalls = unblockedAddonInstalls(addonInstalls, blocks ?? [])

  if (blocks === null) {
    return <p className="studio-help">Loading…</p>
  }

  return (
    <div>
      <ChannelBlockList
        blocks={blocks}
        addonInstalls={addonInstalls}
        pendingId={pendingId}
        onWidthChange={(id, width) => void handleWidthChange(id, width)}
        onReorder={(next) => void handleReorder(next)}
        onRemove={(id) => void handleRemove(id)}
      />

      <div className="studio-mt-lg">
        <h3>Add a block</h3>
        <div className="studio-row studio-gap-sm studio-mt-sm" style={{ alignItems: 'center' }}>
          <input
            type="url"
            className="studio-input"
            placeholder="Logo image URL"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!logoUrl.trim() || pendingId === 'add'}
            onClick={() => void handleAddLogo()}
          >
            Add logo block
          </Button>
        </div>
        <div className="studio-row studio-gap-sm studio-mt-sm" style={{ alignItems: 'center' }}>
          <select
            className="studio-input"
            value={selectedAddonInstallId}
            onChange={(e) => setSelectedAddonInstallId(e.target.value)}
          >
            <option value="">Choose an installed add-on…</option>
            {unblockedInstalls.map((install) => (
              <option key={install.id} value={install.id}>
                {install.widget.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!selectedAddonInstallId || pendingId === 'add'}
            onClick={() => void handleAddAddon()}
          >
            Add add-on block
          </Button>
        </div>
        {addonInstalls.length === 0 && (
          <p className="studio-text-muted-sm studio-mt-xs">
            Install an add-on from the Add-ons section first to place one here.
          </p>
        )}
      </div>

      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </div>
  )
}
