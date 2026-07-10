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

  const publicUrl = resolveChannelUrl(channelSlug)
  const embedSrc = `${resolveAppUrl()}/embed/c/${channelSlug}`
  const embedCode = `<iframe src="${embedSrc}" width="400" height="300" style="border:0;border-radius:12px;overflow:hidden" allow="autoplay; encrypted-media" loading="lazy"></iframe>`
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
            <label className="studio-field--block">
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
              Paste this into any website. Adjust the width/height attributes as needed.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
