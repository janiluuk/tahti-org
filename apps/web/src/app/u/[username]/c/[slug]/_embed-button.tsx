// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
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

function IconEmbed() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M5 4 1.5 8 5 12M11 4l3.5 4-3.5 4M9.5 2.5 6.5 13.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type EmbedSize = 'compact' | 'standard' | 'large'

const EMBED_SIZES: Record<EmbedSize, { label: string; width: number; height: number }> = {
  compact: { label: 'Compact', width: 300, height: 200 },
  standard: { label: 'Standard', width: 400, height: 360 },
  large: { label: 'Large', width: 500, height: 500 },
}

/** "Embed" icon button for a public collection/playlist — opens a modal with a
 * live iframe preview of the embeddable playlist player and a copy-to-clipboard
 * embed code, so listeners can drop it into any website. Anyone can embed a
 * public collection, same as the existing oEmbed support for channels/releases —
 * this just adds the artist-friendly picker UI on top of that. */
export function CollectionEmbedButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="prof-embed-btn"
        onClick={() => setOpen(true)}
        title="Embed this playlist"
        aria-label="Embed this playlist"
      >
        <IconEmbed />
        Embed
      </button>
      {open && <CollectionEmbedModal slug={slug} onClose={() => setOpen(false)} />}
    </>
  )
}

function CollectionEmbedModal({ slug, onClose }: { slug: string; onClose: () => void }) {
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
      className="prof-embed-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Embed this playlist"
      onClick={onClose}
    >
      <div className="prof-embed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="prof-embed-modal__header">
          <h3 className="prof-embed-modal__title">Embed this playlist</h3>
          <button type="button" className="prof-embed-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          className="prof-embed-modal__tabs"
          role="tablist"
          aria-label="Collection sharing options"
        >
          {(['share', 'embed', 'rss'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={`prof-embed-modal__tab${tab === value ? ' prof-embed-modal__tab--active' : ''}`}
              onClick={() => setTab(value)}
            >
              {value === 'share' ? 'Share' : value === 'embed' ? 'Embed' : 'RSS'}
            </button>
          ))}
        </div>

        {tab === 'share' ? (
          <div className="prof-embed-modal__body">
            <label className="prof-embed-modal__field">
              <span className="prof-embed-modal__label">Share link</span>
              <div className="prof-embed-modal__share-row">
                <input
                  readOnly
                  value={shareUrl}
                  className="prof-embed-modal__input"
                  onClick={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="prof-embed-modal__copy-btn"
                  onClick={() => {
                    void navigator.clipboard.writeText(shareUrl)
                    setCopiedShare(true)
                    window.setTimeout(() => setCopiedShare(false), 2000)
                  }}
                >
                  {copiedShare ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </label>
            <div className="prof-embed-modal__platforms">
              {SHARE_TARGETS.map(([label, build]) => (
                <a
                  key={label}
                  href={build(shareUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="prof-embed-modal__copy-btn"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        ) : tab === 'rss' ? (
          <div className="prof-embed-modal__body">
            <label className="prof-embed-modal__field">
              <span className="prof-embed-modal__label">RSS feed</span>
              <div className="prof-embed-modal__share-row">
                <input
                  readOnly
                  value={rssUrl}
                  className="prof-embed-modal__input"
                  onClick={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="prof-embed-modal__copy-btn"
                  onClick={() => void navigator.clipboard.writeText(rssUrl)}
                >
                  Copy
                </button>
              </div>
            </label>
            <p className="prof-embed-modal__hint">
              Follow this collection in a podcast or RSS reader.
            </p>
            <a
              href={rssUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="prof-embed-modal__copy-btn"
            >
              Open RSS feed ↗
            </a>
          </div>
        ) : (
          <div className="prof-embed-modal__body">
            <label className="prof-embed-modal__field">
              <span className="prof-embed-modal__label">Size</span>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as EmbedSize)}
                className="prof-embed-modal__select"
              >
                {(Object.keys(EMBED_SIZES) as EmbedSize[]).map((key) => (
                  <option key={key} value={key}>
                    {EMBED_SIZES[key].label} ({EMBED_SIZES[key].width}×{EMBED_SIZES[key].height})
                  </option>
                ))}
              </select>
            </label>

            <label className="prof-embed-modal__checkbox-row">
              <input
                type="checkbox"
                checked={transparentBg}
                onChange={(e) => setTransparentBg(e.target.checked)}
              />
              Transparent background
            </label>

            <label className="prof-embed-modal__field">
              <span className="prof-embed-modal__label">Embed code</span>
              <textarea
                readOnly
                value={embedCode}
                rows={4}
                className="prof-embed-modal__code"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </label>
            <button
              type="button"
              className="prof-embed-modal__copy-btn"
              onClick={() => void copyCode()}
            >
              {copied ? 'Copied!' : 'Copy embed code'}
            </button>
            <p className="prof-embed-modal__hint">
              Paste this into any website. The preview below updates as you change the options
              above.
            </p>
            <div className="prof-embed-modal__preview">
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
