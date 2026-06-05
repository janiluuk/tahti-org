// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_SOCIAL_TEMPLATE } from '@tahti/shared'
import { disconnectMastodon, postSocialManual, saveMastodonSocial } from './social-actions'

export default function SocialPromoPanel({
  initial,
}: {
  initial: {
    connected: boolean
    instanceUrl: string | null
    onReleasePublished: boolean
    onChannelLive: boolean
    postTemplate: string
  }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [instanceUrl, setInstanceUrl] = useState(initial.instanceUrl ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [onReleasePublished, setOnReleasePublished] = useState(initial.onReleasePublished)
  const [onChannelLive, setOnChannelLive] = useState(initial.onChannelLive)
  const [postTemplate, setPostTemplate] = useState(initial.postTemplate || DEFAULT_SOCIAL_TEMPLATE)
  const [manualPost, setManualPost] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function save() {
    setError(null)
    if (!instanceUrl.trim()) {
      setError('Instance URL is required')
      return
    }
    if (!initial.connected && !accessToken.trim()) {
      setError('Access token is required')
      return
    }
    startTransition(async () => {
      const res = await saveMastodonSocial({
        instanceUrl: instanceUrl.trim(),
        accessToken: accessToken.trim(),
        onReleasePublished,
        onChannelLive,
        postTemplate: postTemplate.trim() || DEFAULT_SOCIAL_TEMPLATE,
      })
      if (res.error) setError(res.error)
      else {
        setAccessToken('')
        setMsg('Mastodon connected — a test post was sent (you can delete it).')
        router.refresh()
      }
    })
  }

  function disconnect() {
    startTransition(async () => {
      const res = await disconnectMastodon()
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  function postManual() {
    if (!manualPost.trim()) return
    startTransition(async () => {
      const res = await postSocialManual(manualPost.trim())
      if (res.error) setError(res.error)
      else {
        setManualPost('')
        setMsg('Post queued — check Mastodon in a minute.')
      }
    })
  }

  return (
    <section className="studio-panel-section">
      <h2 className="studio-section-heading">Social auto-post (Mastodon)</h2>
      <p className="studio-help">
        Create an access token in Mastodon → Preferences → Development. Placeholders:{' '}
        <code>{'{artist}'}</code>, <code>{'{release}'}</code>, <code>{'{smart_link}'}</code>,{' '}
        <code>{'{channel_url}'}</code>.
      </p>

      {initial.connected ? (
        <p className="studio-text-muted-sm">
          Connected to {initial.instanceUrl}. Twitter/Bluesky OAuth deferred.
        </p>
      ) : null}

      <label className="studio-field studio-mt-sm">
        Mastodon instance URL
        <input
          className="studio-input studio-mt-sm"
          value={instanceUrl}
          onChange={(e) => setInstanceUrl(e.target.value)}
          placeholder="https://mastodon.social"
        />
      </label>

      <label className="studio-field studio-mt-sm">
        Access token
        <input
          className="studio-input studio-mt-sm"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder={initial.connected ? 'Leave blank to keep current token' : 'Paste token'}
        />
      </label>

      <label className="studio-field studio-mt-sm">
        Post template
        <input
          className="studio-input studio-mt-sm"
          value={postTemplate}
          onChange={(e) => setPostTemplate(e.target.value)}
        />
      </label>

      <label className="studio-checkbox-row studio-mt-sm">
        <input
          type="checkbox"
          checked={onReleasePublished}
          onChange={(e) => setOnReleasePublished(e.target.checked)}
        />
        Auto-post when a release is published
      </label>

      <label className="studio-checkbox-row studio-mt-sm">
        <input
          type="checkbox"
          checked={onChannelLive}
          onChange={(e) => setOnChannelLive(e.target.checked)}
        />
        Auto-post when channel goes live
      </label>

      <div className="studio-actions studio-mt-md">
        <button type="button" className="studio-btn-primary" disabled={pending} onClick={save}>
          {initial.connected ? 'Update connection' : 'Connect Mastodon'}
        </button>
        {initial.connected ? (
          <button
            type="button"
            className="studio-btn-ghost"
            disabled={pending}
            onClick={disconnect}
          >
            Disconnect
          </button>
        ) : null}
      </div>

      {initial.connected ? (
        <div className="studio-mt-md">
          <label className="studio-field">
            Manual post
            <textarea
              className="studio-input studio-mt-sm"
              rows={2}
              value={manualPost}
              onChange={(e) => setManualPost(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="studio-btn-ghost studio-mt-sm"
            disabled={pending}
            onClick={postManual}
          >
            Post now
          </button>
        </div>
      ) : null}

      {msg ? <p className="studio-text-muted-sm studio-mt-sm">{msg}</p> : null}
      {error ? <p className="studio-text-error studio-mt-sm">{error}</p> : null}
    </section>
  )
}
