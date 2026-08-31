// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { ButtonIcon, Button } from '@tahti/ui'
import { resolveAppUrl } from '@/lib/app-url'
import { collectionRssUrl } from '@/lib/rss-feeds'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

const SHARE_TARGETS = [
  [
    'X / Twitter',
    (url: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
  ],
  [
    'Facebook',
    (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  ],
  ['WhatsApp', (url: string) => `https://wa.me/?text=${encodeURIComponent(url)}`],
] as const

type EmbedSize = 'compact' | 'standard' | 'large'

const EMBED_SIZES: Record<EmbedSize, { label: string; width: number; height: number }> = {
  compact: { label: 'Compact', width: 300, height: 200 },
  standard: { label: 'Standard', width: 400, height: 360 },
  large: { label: 'Large', width: 500, height: 500 },
}

/** Dashboard-side "Embed" button for a collection/playlist — same embeddable
 * player as the public playlist page's embed icon (apps/web/src/app/u/[username]/c/[slug]/_embed-button.tsx),
 * just reachable from the artist's own collections list/editor without
 * needing to visit the public page first. Styled with the same share/embed
 * modal as the channel dashboard and includes the collection RSS feed. */
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
  const [tab, setTab] = useState<'share' | 'embed' | 'rss'>('embed')
  const [copiedShare, setCopiedShare] = useState(false)

  const { width, height } = EMBED_SIZES[size]
  const embedSrc = `${resolveAppUrl()}/embed/col/${slug}${transparentBg ? '?bg=transparent' : ''}`
  const embedCode = `<iframe src="${embedSrc}" width="${width}" height="${height}" style="border:0;border-radius:12px;overflow:hidden" allow="autoplay; encrypted-media" loading="lazy"></iframe>`
  const shareUrl = `${resolveAppUrl()}/embed/col/${slug}`
  const rssUrl = collectionRssUrl(API_BASE, slug)

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

        <div
          className="share-embed-modal__tabs"
          role="tablist"
          aria-label="Collection sharing options"
        >
          {(['share', 'embed', 'rss'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={`share-embed-modal__tab${tab === value ? ' share-embed-modal__tab--active' : ''}`}
              onClick={() => setTab(value)}
            >
              {value === 'share' ? 'Share' : value === 'embed' ? 'Embed' : 'RSS'}
            </button>
          ))}
        </div>

        {tab === 'share' ? (
          <div className="share-embed-modal__body">
            <label className="studio-field--block">
              <span className="studio-label">Share link</span>
              <div className="studio-row--between studio-mt-xs">
                <input
                  readOnly
                  value={shareUrl}
                  className="studio-input"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button
                  onClick={() => {
                    void navigator.clipboard.writeText(shareUrl)
                    setCopiedShare(true)
                    window.setTimeout(() => setCopiedShare(false), 2000)
                  }}
                  variant="secondary"
                  size="sm"
                >
                  {copiedShare ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </label>
            <div className="share-embed-modal__platforms studio-mt-md">
              {SHARE_TARGETS.map(([label, build]) => (
                <a
                  key={label}
                  href={build(shareUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-btn ui-btn--sm ui-btn--secondary"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        ) : tab === 'rss' ? (
          <div className="share-embed-modal__body">
            <label className="studio-field--block">
              <span className="studio-label">RSS feed</span>
              <div className="studio-row--between studio-mt-xs">
                <input
                  readOnly
                  value={rssUrl}
                  className="studio-input"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button
                  onClick={() => void navigator.clipboard.writeText(rssUrl)}
                  variant="secondary"
                  size="sm"
                >
                  Copy
                </Button>
              </div>
            </label>
            <p className="studio-text-muted-sm studio-mt-sm">
              Add this feed to a podcast or RSS reader to follow new items in this collection.
            </p>
            <a
              href={rssUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-btn ui-btn--sm ui-btn--ghost studio-mt-sm"
            >
              Open RSS feed ↗
            </a>
          </div>
        ) : (
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
            <Button
              onClick={() => void copyCode()}
              variant="primary"
              size="sm"
              className="studio-mt-sm"
            >
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
        )}
      </div>
    </div>
  )
}
