// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { ButtonIcon, Button } from '@tahti/ui'
import { resolveAppUrl, resolveChannelUrl } from '@/lib/app-url'

const SHARE_TARGETS: Array<{
  id: string
  label: string
  build: (url: string, text: string) => string
}> = [
  {
    id: 'twitter',
    label: 'X / Twitter',
    build: (url, text) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    build: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    build: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    build: (url, text) =>
      `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    build: (url, text) =>
      `https://mastodon.social/share?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
]

export function ShareEmbedButton({
  channelSlug,
  displayName,
}: {
  channelSlug: string
  displayName: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="ui-btn ui-btn--sm ui-btn--ghost"
        onClick={() => setOpen(true)}
      >
        <ButtonIcon name="link" />
        Share
      </button>
      {open && (
        <ShareEmbedModal
          channelSlug={channelSlug}
          displayName={displayName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

type EmbedSize = 'compact' | 'standard' | 'large'

const EMBED_SIZES: Record<EmbedSize, { label: string; width: number; height: number }> = {
  compact: { label: 'Compact', width: 300, height: 150 },
  standard: { label: 'Standard', width: 400, height: 300 },
  large: { label: 'Large', width: 700, height: 420 },
}

function ShareEmbedModal({
  channelSlug,
  displayName,
  onClose,
}: {
  channelSlug: string
  displayName: string
  onClose: () => void
}) {
  const [tab, setTab] = useState<'share' | 'embed'>('share')
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [size, setSize] = useState<EmbedSize>('standard')
  const [showTracklist, setShowTracklist] = useState(true)
  const [transparentBg, setTransparentBg] = useState(false)

  const publicUrl = resolveChannelUrl(channelSlug)
  const { width, height } = EMBED_SIZES[size]
  const embedParams = new URLSearchParams()
  if (!showTracklist) embedParams.set('tracklist', '0')
  if (transparentBg) embedParams.set('bg', 'transparent')
  const embedQuery = embedParams.toString()
  const embedSrc = `${resolveAppUrl()}/embed/c/${channelSlug}${embedQuery ? `?${embedQuery}` : ''}`
  const embedCode = `<iframe src="${embedSrc}" width="${width}" height="${height}" style="border:0;border-radius:12px;overflow:hidden" allow="autoplay; encrypted-media" loading="lazy"></iframe>`
  const shareText = `Listen to ${displayName} on Tahti`

  async function copy(text: string, which: 'link' | 'code') {
    await navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000)
  }

  return (
    <div
      className="share-embed-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Share and embed"
      onClick={onClose}
    >
      <div className="share-embed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-embed-modal__header">
          <h3 className="share-embed-modal__title">Share &amp; embed</h3>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="share-embed-modal__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'share'}
            className={`share-embed-modal__tab${tab === 'share' ? ' share-embed-modal__tab--active' : ''}`}
            onClick={() => setTab('share')}
          >
            Share
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'embed'}
            className={`share-embed-modal__tab${tab === 'embed' ? ' share-embed-modal__tab--active' : ''}`}
            onClick={() => setTab('embed')}
          >
            Embed
          </button>
        </div>

        {tab === 'share' ? (
          <div className="share-embed-modal__body">
            <label className="studio-field--block">
              <span className="studio-label">Channel link</span>
              <div className="studio-row--between studio-mt-xs">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="studio-input"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button onClick={() => copy(publicUrl, 'link')} variant="secondary" size="sm">
                  {copied === 'link' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </label>
            <div className="share-embed-modal__platforms studio-mt-md">
              {SHARE_TARGETS.map((t) => (
                <a
                  key={t.id}
                  href={t.build(publicUrl, shareText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-btn ui-btn--sm ui-btn--secondary"
                >
                  {t.label}
                </a>
              ))}
            </div>
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
                checked={showTracklist}
                onChange={(e) => setShowTracklist(e.target.checked)}
              />
              Show tracklist while live
            </label>

            <label className="studio-checkbox-row">
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
              onClick={() => copy(embedCode, 'code')}
              variant="primary"
              size="sm"
              className="studio-mt-sm"
            >
              {copied === 'code' ? 'Copied!' : 'Copy embed code'}
            </Button>
            <p className="studio-text-muted-sm studio-mt-sm">
              Paste this into any website. The preview below updates as you change the options
              above.
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
