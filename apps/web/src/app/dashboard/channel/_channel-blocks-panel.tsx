// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ButtonIcon, Field, FileDropzone, Select, SortableList } from '@tahti/ui'
import type {
  AddonInstallView,
  AddonStoreItem,
  ChannelBlockView,
  ChannelBlockWidth,
  PublicChannelBlock,
} from '@tahti/shared'
import { CHANNEL_BLOCK_WIDTHS } from '@tahti/shared'
import { resolveClientApiUrl } from '@/lib/api-url'
import { uploadChannelLogo } from './_upload-user-media'

const WIDTH_LABEL: Record<ChannelBlockWidth, string> = {
  FULL: 'Full',
  HALF: 'Half',
  THIRD: 'Third',
}

function blockLabel(block: ChannelBlockView, installs: AddonInstallView[]): string {
  if (block.type === 'LOGO') return 'Logo'
  const addonId =
    typeof block.configJson === 'object' &&
    block.configJson !== null &&
    'addonInstallId' in block.configJson
      ? String((block.configJson as { addonInstallId?: unknown }).addonInstallId ?? '')
      : ''
  return installs.find((install) => install.id === addonId)?.widget.name ?? 'Addon'
}

function toPreview(block: ChannelBlockView, installs: AddonInstallView[]): PublicChannelBlock {
  const config = block.configJson as {
    url?: unknown
    addonInstallId?: unknown
  } | null
  const logoUrl = typeof config?.url === 'string' ? config.url : null
  const addonId = typeof config?.addonInstallId === 'string' ? config.addonInstallId : null
  const install = addonId ? installs.find((item) => item.id === addonId) : undefined
  return {
    id: block.id,
    type: block.type,
    width: block.width,
    position: block.position,
    logoUrl,
    addon: install
      ? {
          installId: install.id,
          widgetSlug: install.widget.slug,
          name: install.widget.name,
          sandboxUrl: '',
          version: install.widget.currentVersion,
          position: block.position,
          config: install.configJson,
          context: {},
        }
      : null,
  }
}

export function ChannelBlocksPanel({
  onPreviewChange,
}: {
  onPreviewChange?: (blocks: PublicChannelBlock[]) => void
}) {
  const api = resolveClientApiUrl()
  const [blocks, setBlocks] = useState<ChannelBlockView[]>([])
  const [installs, setInstalls] = useState<AddonInstallView[]>([])
  const [store, setStore] = useState<AddonStoreItem[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addonId, setAddonId] = useState('')
  const [storeWidgetId, setStoreWidgetId] = useState('')
  const [newWidth, setNewWidth] = useState<ChannelBlockWidth>('FULL')

  const placedAddonIds = useMemo(() => {
    const ids = new Set<string>()
    for (const block of blocks) {
      if (block.type !== 'ADDON') continue
      const config = block.configJson as { addonInstallId?: unknown } | null
      if (typeof config?.addonInstallId === 'string') ids.add(config.addonInstallId)
    }
    return ids
  }, [blocks])

  const availableInstalls = installs.filter(
    (install) => install.enabled && !placedAddonIds.has(install.id),
  )
  const installedWidgetIds = new Set(installs.map((install) => install.widget.id))
  const availableStore = store.filter((widget) => !installedWidgetIds.has(widget.id))

  const emitPreview = useCallback(
    (next: ChannelBlockView[], nextInstalls: AddonInstallView[]) => {
      onPreviewChange?.(next.map((block) => toPreview(block, nextInstalls)))
    },
    [onPreviewChange],
  )

  const load = useCallback(async () => {
    const [blocksRes, installsRes, storeRes] = await Promise.all([
      fetch(`${api}/api/me/channel/blocks`, { credentials: 'include' }),
      fetch(`${api}/api/me/channel/addons/installs`, { credentials: 'include' }),
      fetch(`${api}/api/addons/store?scope=ARTIST`, { credentials: 'include' }),
    ])
    const nextBlocks = blocksRes.ok
      ? ((await blocksRes.json()) as { blocks: ChannelBlockView[] }).blocks
      : []
    const nextInstalls = installsRes.ok
      ? ((await installsRes.json()) as { installs: AddonInstallView[] }).installs
      : []
    const nextStore = storeRes.ok
      ? ((await storeRes.json()) as { widgets: AddonStoreItem[] }).widgets
      : []
    setBlocks(nextBlocks)
    setInstalls(nextInstalls)
    setStore(nextStore)
    emitPreview(nextBlocks, nextInstalls)
  }, [api, emitPreview])

  useEffect(() => {
    void load()
  }, [load])

  async function readError(res: Response): Promise<string> {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return body.error ?? 'Request failed'
  }

  async function addLogo(files: File[]) {
    const file = files[0]
    if (!file) return
    setPending(true)
    setError(null)
    try {
      const uploaded = await uploadChannelLogo(file)
      const res = await fetch(`${api}/api/me/channel/blocks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'LOGO',
          width: newWidth,
          configJson: { assetId: uploaded.id, url: uploaded.url },
        }),
      })
      if (!res.ok) throw new Error(await readError(res))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add logo')
    } finally {
      setPending(false)
    }
  }

  async function placeAddon(installId: string) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${api}/api/me/channel/blocks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ADDON',
          width: newWidth,
          configJson: { addonInstallId: installId },
        }),
      })
      if (!res.ok) throw new Error(await readError(res))
      setAddonId('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place addon')
    } finally {
      setPending(false)
    }
  }

  async function installAndPlace() {
    if (!storeWidgetId) return
    setPending(true)
    setError(null)
    try {
      const installed = await fetch(`${api}/api/me/channel/addons/installs`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetId: storeWidgetId }),
      })
      if (!installed.ok) throw new Error(await readError(installed))
      const install = (await installed.json()) as AddonInstallView
      const placed = await fetch(`${api}/api/me/channel/blocks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ADDON',
          width: newWidth,
          configJson: { addonInstallId: install.id },
        }),
      })
      if (!placed.ok) throw new Error(await readError(placed))
      setStoreWidgetId('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not install addon')
    } finally {
      setPending(false)
    }
  }

  async function patchWidth(id: string, width: ChannelBlockWidth) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${api}/api/me/channel/blocks/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width }),
      })
      if (!res.ok) throw new Error(await readError(res))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update width')
    } finally {
      setPending(false)
    }
  }

  async function removeBlock(id: string) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${api}/api/me/channel/blocks/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok && res.status !== 204) throw new Error(await readError(res))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove block')
    } finally {
      setPending(false)
    }
  }

  async function reorder(next: ChannelBlockView[]) {
    const previous = blocks
    setBlocks(next)
    emitPreview(next, installs)
    const res = await fetch(`${api}/api/me/channel/blocks/reorder`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map((block) => block.id) }),
    })
    if (!res.ok) {
      setBlocks(previous)
      emitPreview(previous, installs)
      setError(await readError(res))
    }
  }

  return (
    <div className="channel-blocks-panel">
      {error && <p className="studio-notice studio-notice--error">{error}</p>}

      <Field htmlFor="channel-block-width" label="Width for the next block">
        <Select
          id="channel-block-width"
          value={newWidth}
          disabled={pending}
          onChange={(e) => setNewWidth(e.target.value as ChannelBlockWidth)}
        >
          {CHANNEL_BLOCK_WIDTHS.map((width) => (
            <option key={width} value={width}>
              {WIDTH_LABEL[width]}
            </option>
          ))}
        </Select>
      </Field>

      <FileDropzone
        accept="image/png,image/webp"
        disabled={pending}
        label="Drop a logo (PNG or WebP)"
        hint="Alpha PNG or WebP. Uses the same media upload pipeline as gallery images."
        onFiles={(files) => void addLogo(files)}
      />

      {availableInstalls.length > 0 && (
        <div className="channel-blocks-panel__row">
          <Field htmlFor="channel-block-addon" label="Place an installed addon">
            <Select
              id="channel-block-addon"
              value={addonId}
              disabled={pending}
              onChange={(e) => setAddonId(e.target.value)}
            >
              <option value="">Choose addon…</option>
              {availableInstalls.map((install) => (
                <option key={install.id} value={install.id}>
                  {install.widget.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !addonId}
            onClick={() => void placeAddon(addonId)}
          >
            <ButtonIcon name="plus" />
            Place addon
          </Button>
        </div>
      )}

      {availableStore.length > 0 && (
        <div className="channel-blocks-panel__row">
          <Field htmlFor="channel-block-store" label="Install an addon and place it">
            <Select
              id="channel-block-store"
              value={storeWidgetId}
              disabled={pending}
              onChange={(e) => setStoreWidgetId(e.target.value)}
            >
              <option value="">Choose from store…</option>
              {availableStore.map((widget) => (
                <option key={widget.id} value={widget.id}>
                  {widget.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !storeWidgetId}
            onClick={() => void installAndPlace()}
          >
            <ButtonIcon name="plus" />
            Install & place
          </Button>
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="studio-text-muted-sm">
          No blocks yet. Add a logo or place an addon. Rows pack automatically: full occupies a row;
          two halves or three thirds share one.
        </p>
      ) : (
        <SortableList
          as="div"
          className="channel-blocks-list"
          items={blocks}
          itemId={(block) => block.id}
          onReorder={(next) => void reorder(next)}
          renderItem={(block, _index, sortable) => (
            <div
              ref={sortable.ref}
              className={`ui-panel channel-blocks-row${sortable.isDragging ? ' is-dragging' : ''}`}
            >
              <button
                ref={sortable.handleRef}
                type="button"
                className="channel-blocks-row__handle"
                aria-label={`Reorder ${blockLabel(block, installs)}`}
                disabled={pending}
              >
                ⠿
              </button>
              <div className="channel-blocks-row__body">
                <strong>{blockLabel(block, installs)}</strong>
                {block.type === 'LOGO' &&
                typeof (block.configJson as { url?: unknown } | null)?.url === 'string' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- artist-uploaded CDN URL
                  <img
                    src={(block.configJson as { url: string }).url}
                    alt=""
                    className="channel-blocks-row__thumb"
                  />
                ) : null}
              </div>
              <Select
                aria-label={`Width for ${blockLabel(block, installs)}`}
                value={block.width}
                disabled={pending}
                onChange={(e) => void patchWidth(block.id, e.target.value as ChannelBlockWidth)}
              >
                {CHANNEL_BLOCK_WIDTHS.map((width) => (
                  <option key={width} value={width}>
                    {WIDTH_LABEL[width]}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() => void removeBlock(block.id)}
              >
                <ButtonIcon name="trash" />
                Remove
              </Button>
            </div>
          )}
        />
      )}
    </div>
  )
}
