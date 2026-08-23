// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { ButtonIcon, Button } from '@tahti/ui'
import { resolveAppUrl } from '@/lib/app-url'

type EmbedSize = 'compact' | 'standard' | 'large'

const EMBED_SIZES: Record<EmbedSize, { label: string; width: number; height: number }> = {
  compact: { label: 'Compact', width: 300, height: 200 },
  standard: { label: 'Standard', width: 400, height: 360 },
  large: { label: 'Large', width: 500, height: 500 },
}

/** Dashboard-side "Embed" button for a collection/playlist — same embeddable
 * player as the public playlist page's embed icon (apps/web/src/app/u/[username]/c/[slug]/_embed-button.tsx),
 * just reachable from the artist's own collections list/editor without
 * needing to visit the public page first. Styled with the same
 * share-embed-modal classes as the channel dashboard's ShareEmbedButton for
 * consistency, minus the Share tab — a collection has no public smart-link
 * page of its own to share, only the embed. */
export function CollectionEmbedButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="ui-btn ui-btn--sm ui-btn--ghost"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        title="Embed this playlist"
        aria-label="Embed this playlist"
      >
        <ButtonIcon name="link" />
        Embed
      </button>
      {open && (
        <CollectionEmbedModal
          slug={slug}
          onClose={(e) => {
            e?.stopPropagation()
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function CollectionEmbedModal({
  slug,
  onClose,
}: {
  slug: string
  onClose: (e?: React.MouseEvent) => void
}) {
  const [size, setSize] = useState<EmbedSize>('standard')
  const [transparentBg, setTransparentBg] = useState(false)
  const [copied, setCopied] = useState(false)

  const { width, height } = EMBED_SIZES[size]
  const embedSrc = `${resolveAppUrl()}/embed/col/${slug}${transparentBg ? '?bg=transparent' : ''}`
  const embedCode = `<iframe src="${embedSrc}" width="${width}" height="${height}" style="border:0;border-radius:12px;overflow:hidden" allow="autoplay; encrypted-media" loading="lazy"></iframe>`

  async function copyCode() {
    await navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="share-embed-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Embed this playlist"
      onClick={(e) => onClose(e)}
    >
      <div className="share-embed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-embed-modal__header">
          <h3 className="share-embed-modal__title">Embed this playlist</h3>
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            onClick={(e) => onClose(e)}
          >
            Close
          </button>
        </div>

        <div className="share-embed-modal__body">
          <label className="studio-label-row studio-text-sm">
            Size
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as EmbedSize)}
              className="studio-input studio-select-min"
            >
              {(Object.keys(EMBED_SIZES) as EmbedSize[]).map((key) => (
                <option key={key} value={key}>
                  {EMBED_SIZES[key].label} ({EMBED_SIZES[key].width}×{EMBED_SIZES[key].height})
                </option>
              ))}
            </select>
          </label>

          <label className="studio-checkbox-row studio-mt-sm">
            <input
              type="checkbox"
              checked={transparentBg}
              onChange={(e) => setTransparentBg(e.target.checked)}
            />
            Transparent background
          </label>

          <label className="studio-field--block studio-mt-sm">
            <span className="studio-label">Embed code</span>
            <textarea
              readOnly
              value={embedCode}
              rows={4}
              className="studio-input studio-mt-xs"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </label>
          <Button onClick={() => void copyCode()} variant="primary" size="sm" className="studio-mt-sm">
            <ButtonIcon name="link" />
            {copied ? 'Copied!' : 'Copy embed code'}
          </Button>
          <p className="studio-text-muted-sm studio-mt-sm">
            Paste this into any website. The preview below updates as you change the options
            above. Anyone with the link can play — same as the public playlist page.
          </p>
          <div className="share-embed-modal__preview studio-mt-sm">
            <iframe
              key={embedSrc}
              src={embedSrc}
              width={width}
              height={height}
              style={{ border: 0, borderRadius: 12, overflow: 'hidden', maxWidth: '100%' }}
              title="Embed preview"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
