// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_SOCIAL_TEMPLATE } from '@tahti/shared'
import {
  disconnectBluesky,
  disconnectInstagram,
  disconnectMastodon,
  disconnectTwitter,
  postSocialManual,
  saveBlueskySocial,
  saveInstagramSocial,
  saveMastodonSocial,
  saveTwitterSocial,
  type SocialSettings,
} from './social-actions'

function PlatformSection({
  title,
  help,
  connected,
  accountLabel,
  children,
  onDisconnect,
  pending,
  manualPost,
  onManualPostChange,
  onManualPost,
  manualPostLabel,
}: {
  title: string
  help: ReactNode
  connected: boolean
  accountLabel: string | null
  children: ReactNode
  onDisconnect: () => void
  pending: boolean
  manualPost: string
  onManualPostChange: (v: string) => void
  onManualPost: () => void
  manualPostLabel: string
}) {
  return (
    <div className="studio-mt-md">
      <h3 className="studio-section-heading">{title}</h3>
      <p className="studio-help">{help}</p>
      {connected && accountLabel ? (
        <p className="studio-text-muted-sm">Connected as {accountLabel}</p>
      ) : null}
      {children}
      {connected ? (
        <>
          <button
            type="button"
            className="studio-btn-ghost studio-mt-sm"
            disabled={pending}
            onClick={onDisconnect}
          >
            Disconnect
          </button>
          <div className="studio-mt-md">
            <label className="studio-field">
              Manual post
              <textarea
                className="studio-input studio-mt-sm"
                rows={2}
                value={manualPost}
                onChange={(e) => onManualPostChange(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="studio-btn-ghost studio-mt-sm"
              disabled={pending}
              onClick={onManualPost}
            >
              {manualPostLabel}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default function SocialPromoPanel({
  initial,
  apiUrl,
}: {
  initial: SocialSettings
  apiUrl: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [mastodonUrl, setMastodonUrl] = useState(initial.mastodon.accountLabel ?? '')
  const [mastodonToken, setMastodonToken] = useState('')
  const [mastodonRelease, setMastodonRelease] = useState(initial.mastodon.onReleasePublished)
  const [mastodonLive, setMastodonLive] = useState(initial.mastodon.onChannelLive)
  const [mastodonTemplate, setMastodonTemplate] = useState(
    initial.mastodon.postTemplate || DEFAULT_SOCIAL_TEMPLATE,
  )
  const [mastodonManual, setMastodonManual] = useState('')

  const [blueskyHandle, setBlueskyHandle] = useState(initial.bluesky.accountLabel ?? '')
  const [blueskyPassword, setBlueskyPassword] = useState('')
  const [blueskyRelease, setBlueskyRelease] = useState(initial.bluesky.onReleasePublished)
  const [blueskyLive, setBlueskyLive] = useState(initial.bluesky.onChannelLive)
  const [blueskyTemplate, setBlueskyTemplate] = useState(
    initial.bluesky.postTemplate || DEFAULT_SOCIAL_TEMPLATE,
  )
  const [blueskyManual, setBlueskyManual] = useState('')

  const [twitterRelease, setTwitterRelease] = useState(initial.twitter.onReleasePublished)
  const [twitterLive, setTwitterLive] = useState(initial.twitter.onChannelLive)
  const [twitterTemplate, setTwitterTemplate] = useState(
    initial.twitter.postTemplate || DEFAULT_SOCIAL_TEMPLATE,
  )
  const [twitterManual, setTwitterManual] = useState('')

  const [instagramRelease, setInstagramRelease] = useState(initial.instagram.onReleasePublished)
  const [instagramLive, setInstagramLive] = useState(initial.instagram.onChannelLive)
  const [instagramTemplate, setInstagramTemplate] = useState(
    initial.instagram.postTemplate || DEFAULT_SOCIAL_TEMPLATE,
  )
  const [instagramManual, setInstagramManual] = useState('')

  function saveMastodon() {
    setError(null)
    if (!mastodonUrl.trim()) {
      setError('Mastodon instance URL is required')
      return
    }
    if (!initial.mastodon.connected && !mastodonToken.trim()) {
      setError('Mastodon access token is required')
      return
    }
    startTransition(async () => {
      const res = await saveMastodonSocial({
        instanceUrl: mastodonUrl.trim(),
        accessToken: mastodonToken.trim(),
        onReleasePublished: mastodonRelease,
        onChannelLive: mastodonLive,
        postTemplate: mastodonTemplate.trim() || DEFAULT_SOCIAL_TEMPLATE,
      })
      if (res.error) setError(res.error)
      else {
        setMastodonToken('')
        setMsg('Mastodon connected — a test post was sent (you can delete it).')
        router.refresh()
      }
    })
  }

  function saveBluesky() {
    setError(null)
    if (!blueskyHandle.trim()) {
      setError('Bluesky handle is required')
      return
    }
    if (!initial.bluesky.connected && !blueskyPassword.trim()) {
      setError('Bluesky app password is required')
      return
    }
    startTransition(async () => {
      const res = await saveBlueskySocial({
        handle: blueskyHandle.trim(),
        appPassword: blueskyPassword.trim(),
        onReleasePublished: blueskyRelease,
        onChannelLive: blueskyLive,
        postTemplate: blueskyTemplate.trim() || DEFAULT_SOCIAL_TEMPLATE,
      })
      if (res.error) setError(res.error)
      else {
        setBlueskyPassword('')
        setMsg('Bluesky connected — a test post was sent (you can delete it).')
        router.refresh()
      }
    })
  }

  return (
    <section className="studio-panel-section">
      <h2 className="studio-section-heading">Social auto-post</h2>
      <p className="studio-help">
        Placeholders: <code>{'{artist}'}</code>, <code>{'{release}'}</code>,{' '}
        <code>{'{smart_link}'}</code>, <code>{'{channel_url}'}</code>.
      </p>

      <PlatformSection
        title="Mastodon"
        help={<>Create an access token in Mastodon → Preferences → Development.</>}
        connected={initial.mastodon.connected}
        accountLabel={initial.mastodon.accountLabel}
        pending={pending}
        manualPost={mastodonManual}
        onManualPostChange={setMastodonManual}
        onManualPost={() => {
          if (!mastodonManual.trim()) return
          startTransition(async () => {
            const res = await postSocialManual('MASTODON', mastodonManual.trim())
            if (res.error) setError(res.error)
            else {
              setMastodonManual('')
              setMsg('Mastodon post queued.')
            }
          })
        }}
        manualPostLabel="Post to Mastodon"
        onDisconnect={() => {
          startTransition(async () => {
            const res = await disconnectMastodon()
            if (res.error) setError(res.error)
            else router.refresh()
          })
        }}
      >
        <label className="studio-field studio-mt-sm">
          Instance URL
          <input
            className="studio-input studio-mt-sm"
            value={mastodonUrl}
            onChange={(e) => setMastodonUrl(e.target.value)}
            placeholder="https://mastodon.social"
          />
        </label>
        <label className="studio-field studio-mt-sm">
          Access token
          <input
            className="studio-input studio-mt-sm"
            type="password"
            value={mastodonToken}
            onChange={(e) => setMastodonToken(e.target.value)}
            placeholder={
              initial.mastodon.connected ? 'Leave blank to keep current token' : 'Paste token'
            }
          />
        </label>
        <label className="studio-field studio-mt-sm">
          Post template
          <input
            className="studio-input studio-mt-sm"
            value={mastodonTemplate}
            onChange={(e) => setMastodonTemplate(e.target.value)}
          />
        </label>
        <label className="studio-checkbox-row studio-mt-sm">
          <input
            type="checkbox"
            checked={mastodonRelease}
            onChange={(e) => setMastodonRelease(e.target.checked)}
          />
          Auto-post when a release is published
        </label>
        <label className="studio-checkbox-row studio-mt-sm">
          <input
            type="checkbox"
            checked={mastodonLive}
            onChange={(e) => setMastodonLive(e.target.checked)}
          />
          Auto-post when channel goes live
        </label>
        <div className="studio-actions studio-mt-md">
          <button
            type="button"
            className="studio-btn-primary"
            disabled={pending}
            onClick={saveMastodon}
          >
            {initial.mastodon.connected ? 'Update Mastodon' : 'Connect Mastodon'}
          </button>
        </div>
      </PlatformSection>

      <PlatformSection
        title="Bluesky"
        help={<>Create an app password at bsky.app → Settings → App passwords.</>}
        connected={initial.bluesky.connected}
        accountLabel={initial.bluesky.accountLabel}
        pending={pending}
        manualPost={blueskyManual}
        onManualPostChange={setBlueskyManual}
        onManualPost={() => {
          if (!blueskyManual.trim()) return
          startTransition(async () => {
            const res = await postSocialManual('BLUESKY', blueskyManual.trim())
            if (res.error) setError(res.error)
            else {
              setBlueskyManual('')
              setMsg('Bluesky post queued.')
            }
          })
        }}
        manualPostLabel="Post to Bluesky"
        onDisconnect={() => {
          startTransition(async () => {
            const res = await disconnectBluesky()
            if (res.error) setError(res.error)
            else router.refresh()
          })
        }}
      >
        <label className="studio-field studio-mt-sm">
          Handle
          <input
            className="studio-input studio-mt-sm"
            value={blueskyHandle}
            onChange={(e) => setBlueskyHandle(e.target.value)}
            placeholder="you.bsky.social"
          />
        </label>
        <label className="studio-field studio-mt-sm">
          App password
          <input
            className="studio-input studio-mt-sm"
            type="password"
            value={blueskyPassword}
            onChange={(e) => setBlueskyPassword(e.target.value)}
            placeholder={
              initial.bluesky.connected ? 'Leave blank to keep current password' : 'Paste password'
            }
          />
        </label>
        <label className="studio-field studio-mt-sm">
          Post template
          <input
            className="studio-input studio-mt-sm"
            value={blueskyTemplate}
            onChange={(e) => setBlueskyTemplate(e.target.value)}
          />
        </label>
        <label className="studio-checkbox-row studio-mt-sm">
          <input
            type="checkbox"
            checked={blueskyRelease}
            onChange={(e) => setBlueskyRelease(e.target.checked)}
          />
          Auto-post when a release is published
        </label>
        <label className="studio-checkbox-row studio-mt-sm">
          <input
            type="checkbox"
            checked={blueskyLive}
            onChange={(e) => setBlueskyLive(e.target.checked)}
          />
          Auto-post when channel goes live
        </label>
        <div className="studio-actions studio-mt-md">
          <button
            type="button"
            className="studio-btn-primary"
            disabled={pending}
            onClick={saveBluesky}
          >
            {initial.bluesky.connected ? 'Update Bluesky' : 'Connect Bluesky'}
          </button>
        </div>
      </PlatformSection>

      <PlatformSection
        title="X (Twitter)"
        help={
          <>
            OAuth 2.0 connect — posts when configured below. Requires <code>TWITTER_CLIENT_ID</code>{' '}
            on the server.
          </>
        }
        connected={initial.twitter.connected}
        accountLabel={initial.twitter.accountLabel}
        pending={pending}
        manualPost={twitterManual}
        onManualPostChange={setTwitterManual}
        onManualPost={() => {
          if (!twitterManual.trim()) return
          startTransition(async () => {
            const res = await postSocialManual('TWITTER', twitterManual.trim())
            if (res.error) setError(res.error)
            else {
              setTwitterManual('')
              setMsg('X post queued.')
            }
          })
        }}
        manualPostLabel="Post to X"
        onDisconnect={() => {
          startTransition(async () => {
            const res = await disconnectTwitter()
            if (res.error) setError(res.error)
            else router.refresh()
          })
        }}
      >
        {!initial.twitter.configured ? (
          <p className="studio-text-muted-sm">X OAuth is not configured on this server.</p>
        ) : initial.twitter.connected ? (
          <>
            <label className="studio-field studio-mt-sm">
              Post template
              <input
                className="studio-input studio-mt-sm"
                value={twitterTemplate}
                onChange={(e) => setTwitterTemplate(e.target.value)}
                maxLength={280}
              />
            </label>
            <label className="studio-checkbox-row studio-mt-sm">
              <input
                type="checkbox"
                checked={twitterRelease}
                onChange={(e) => setTwitterRelease(e.target.checked)}
              />
              Auto-post when a release is published
            </label>
            <label className="studio-checkbox-row studio-mt-sm">
              <input
                type="checkbox"
                checked={twitterLive}
                onChange={(e) => setTwitterLive(e.target.checked)}
              />
              Auto-post when channel goes live
            </label>
            <div className="studio-actions studio-mt-md">
              <button
                type="button"
                className="studio-btn-primary"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await saveTwitterSocial({
                      onReleasePublished: twitterRelease,
                      onChannelLive: twitterLive,
                      postTemplate: twitterTemplate,
                    })
                    if (res.error) setError(res.error)
                    else {
                      setMsg('X settings saved.')
                      router.refresh()
                    }
                  })
                }}
              >
                Update X settings
              </button>
            </div>
          </>
        ) : (
          <a href={`${apiUrl}/api/me/social/twitter/oauth/start`} className="studio-btn-primary">
            Connect X account
          </a>
        )}
      </PlatformSection>

      <PlatformSection
        title="Instagram"
        help={
          <>
            OAuth connect via your Instagram professional account on a Facebook Page. Every post
            needs an image — we use your release cover art, channel banner, or profile picture.
            Requires <code>INSTAGRAM_CLIENT_ID</code> on the server.
          </>
        }
        connected={initial.instagram.connected}
        accountLabel={initial.instagram.accountLabel}
        pending={pending}
        manualPost={instagramManual}
        onManualPostChange={setInstagramManual}
        onManualPost={() => {
          if (!instagramManual.trim()) return
          startTransition(async () => {
            const res = await postSocialManual('INSTAGRAM', instagramManual.trim())
            if (res.error) setError(res.error)
            else {
              setInstagramManual('')
              setMsg('Instagram post queued.')
            }
          })
        }}
        manualPostLabel="Post to Instagram"
        onDisconnect={() => {
          startTransition(async () => {
            const res = await disconnectInstagram()
            if (res.error) setError(res.error)
            else router.refresh()
          })
        }}
      >
        {!initial.instagram.configured ? (
          <p className="studio-text-muted-sm">Instagram OAuth is not configured on this server.</p>
        ) : initial.instagram.connected ? (
          <>
            <label className="studio-field studio-mt-sm">
              Post template
              <input
                className="studio-input studio-mt-sm"
                value={instagramTemplate}
                onChange={(e) => setInstagramTemplate(e.target.value)}
                maxLength={2200}
              />
            </label>
            <label className="studio-checkbox-row studio-mt-sm">
              <input
                type="checkbox"
                checked={instagramRelease}
                onChange={(e) => setInstagramRelease(e.target.checked)}
              />
              Auto-post when a release is published
            </label>
            <label className="studio-checkbox-row studio-mt-sm">
              <input
                type="checkbox"
                checked={instagramLive}
                onChange={(e) => setInstagramLive(e.target.checked)}
              />
              Auto-post when channel goes live
            </label>
            <div className="studio-actions studio-mt-md">
              <button
                type="button"
                className="studio-btn-primary"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await saveInstagramSocial({
                      onReleasePublished: instagramRelease,
                      onChannelLive: instagramLive,
                      postTemplate: instagramTemplate,
                    })
                    if (res.error) setError(res.error)
                    else {
                      setMsg('Instagram settings saved.')
                      router.refresh()
                    }
                  })
                }}
              >
                Update Instagram settings
              </button>
            </div>
          </>
        ) : (
          <a href={`${apiUrl}/api/me/social/instagram/oauth/start`} className="studio-btn-primary">
            Connect Instagram account
          </a>
        )}
      </PlatformSection>

      {msg ? <p className="studio-text-muted-sm studio-mt-sm">{msg}</p> : null}
      {error ? <p className="studio-text-error studio-mt-sm">{error}</p> : null}
    </section>
  )
}
