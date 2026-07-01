// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_SOCIAL_TEMPLATE } from '@tahti/shared'
import { ButtonIcon, Panel, StudioCollapse, Button } from '@tahti/ui'
import {
  SocialActions,
  SocialField,
  SocialInput,
  SocialOptions,
  SocialTextarea,
  SocialToggle,
} from './_social-form-fields'
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
    <StudioCollapse
      className={`studio-social-platform${connected ? ' studio-social-platform--connected' : ''}`}
      title={title}
      hint={
        connected ? <span className="studio-badge studio-badge--success">Connected</span> : 'Setup'
      }
      defaultOpen={connected}
    >
      <div className="studio-social-platform__body">
        <p className="studio-social-platform__help">{help}</p>
        {connected && accountLabel ? (
          <p className="studio-social-platform__account">
            Signed in as <span>{accountLabel}</span>
          </p>
        ) : null}
        <div className="studio-social-form">{children}</div>
        {connected ? (
          <div className="studio-social-manual">
            <SocialField label="Post manually">
              <SocialTextarea
                value={manualPost}
                onChange={(e) => onManualPostChange(e.target.value)}
              />
            </SocialField>
            <SocialActions>
              <Button
                disabled={pending || !manualPost.trim()}
                onClick={onManualPost}
                variant="ghost"
                size="sm"
              >
                {manualPostLabel}
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  if (confirm(`Disconnect ${title}? You'll need to reconnect to post again.`)) {
                    onDisconnect()
                  }
                }}
                variant="danger"
                size="sm"
              >
                <ButtonIcon name="unlink" />
                Disconnect
              </Button>
            </SocialActions>
          </div>
        ) : null}
      </div>
    </StudioCollapse>
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
    setMsg(null)
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
    setMsg(null)
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
    <Panel
      title="Social auto-post"
      headerTight
      description="Connect platforms to announce releases and live sessions automatically."
    >
      <p className="studio-help">
        Placeholders: <code>{'{artist}'}</code>, <code>{'{release}'}</code>,{' '}
        <code>{'{smart_link}'}</code>, <code>{'{channel_url}'}</code>.
      </p>
      {msg ? <p className="studio-notice studio-notice--success studio-my-xs">{msg}</p> : null}
      {error ? <p className="studio-notice studio-notice--error studio-my-xs">{error}</p> : null}

      <div className="studio-social-stack">
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
          <SocialField label="Instance URL">
            <SocialInput
              value={mastodonUrl}
              onChange={(e) => setMastodonUrl(e.target.value)}
              placeholder="https://mastodon.social"
            />
          </SocialField>
          <SocialField
            label="Access token"
            hint={
              initial.mastodon.connected ? 'Leave blank to keep your current token.' : undefined
            }
          >
            <SocialInput
              type="password"
              value={mastodonToken}
              onChange={(e) => setMastodonToken(e.target.value)}
              placeholder={initial.mastodon.connected ? 'Unchanged' : 'Paste token'}
            />
          </SocialField>
          <SocialField label="Post template">
            <SocialInput
              value={mastodonTemplate}
              onChange={(e) => setMastodonTemplate(e.target.value)}
            />
          </SocialField>
          <SocialOptions>
            <SocialToggle
              label="Auto-post when a release is published"
              checked={mastodonRelease}
              onChange={setMastodonRelease}
            />
            <SocialToggle
              label="Auto-post when channel goes live"
              checked={mastodonLive}
              onChange={setMastodonLive}
            />
          </SocialOptions>
          <SocialActions>
            <Button disabled={pending} onClick={saveMastodon} variant="primary">
              <ButtonIcon name="link" />
              {initial.mastodon.connected ? 'Update Mastodon' : 'Connect Mastodon'}
            </Button>
          </SocialActions>
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
          <SocialField label="Handle">
            <SocialInput
              value={blueskyHandle}
              onChange={(e) => setBlueskyHandle(e.target.value)}
              placeholder="you.bsky.social"
            />
          </SocialField>
          <SocialField
            label="App password"
            hint={
              initial.bluesky.connected ? 'Leave blank to keep your current password.' : undefined
            }
          >
            <SocialInput
              type="password"
              value={blueskyPassword}
              onChange={(e) => setBlueskyPassword(e.target.value)}
              placeholder={initial.bluesky.connected ? 'Unchanged' : 'Paste app password'}
            />
          </SocialField>
          <SocialField label="Post template">
            <SocialInput
              value={blueskyTemplate}
              onChange={(e) => setBlueskyTemplate(e.target.value)}
            />
          </SocialField>
          <SocialOptions>
            <SocialToggle
              label="Auto-post when a release is published"
              checked={blueskyRelease}
              onChange={setBlueskyRelease}
            />
            <SocialToggle
              label="Auto-post when channel goes live"
              checked={blueskyLive}
              onChange={setBlueskyLive}
            />
          </SocialOptions>
          <SocialActions>
            <Button disabled={pending} onClick={saveBluesky} variant="primary">
              <ButtonIcon name="link" />
              {initial.bluesky.connected ? 'Update Bluesky' : 'Connect Bluesky'}
            </Button>
          </SocialActions>
        </PlatformSection>

        <PlatformSection
          title="X (Twitter)"
          help={
            <>
              OAuth 2.0 connect — posts when configured below. Requires{' '}
              <code>TWITTER_CLIENT_ID</code> on the server.
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
            <div className="import-connect">
              <p className="import-connect__note import-connect__note--muted">
                X (Twitter) posting needs a platform API key that hasn&apos;t been set up yet.
              </p>
              <a href="/admin/settings/vendors" className="ui-btn ui-btn--secondary ui-btn--sm">
                Configure
              </a>
            </div>
          ) : initial.twitter.connected ? (
            <>
              <SocialField label="Post template">
                <SocialInput
                  value={twitterTemplate}
                  onChange={(e) => setTwitterTemplate(e.target.value)}
                  maxLength={280}
                />
              </SocialField>
              <SocialOptions>
                <SocialToggle
                  label="Auto-post when a release is published"
                  checked={twitterRelease}
                  onChange={setTwitterRelease}
                />
                <SocialToggle
                  label="Auto-post when channel goes live"
                  checked={twitterLive}
                  onChange={setTwitterLive}
                />
              </SocialOptions>
              <SocialActions>
                <Button
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
                  variant="primary"
                >
                  <ButtonIcon name="link" />
                  Update X settings
                </Button>
              </SocialActions>
            </>
          ) : (
            <SocialActions>
              <a
                href={`${apiUrl}/api/me/social/twitter/oauth/start`}
                className="ui-btn ui-btn--primary"
              >
                <ButtonIcon name="link" />
                Connect X account
              </a>
            </SocialActions>
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
            <div className="import-connect">
              <p className="import-connect__note import-connect__note--muted">
                Instagram posting needs a platform API key that hasn&apos;t been set up yet.
              </p>
              <a href="/admin/settings/vendors" className="ui-btn ui-btn--secondary ui-btn--sm">
                Configure
              </a>
            </div>
          ) : initial.instagram.connected ? (
            <>
              <SocialField label="Post template">
                <SocialInput
                  value={instagramTemplate}
                  onChange={(e) => setInstagramTemplate(e.target.value)}
                  maxLength={2200}
                />
              </SocialField>
              <SocialOptions>
                <SocialToggle
                  label="Auto-post when a release is published"
                  checked={instagramRelease}
                  onChange={setInstagramRelease}
                />
                <SocialToggle
                  label="Auto-post when channel goes live"
                  checked={instagramLive}
                  onChange={setInstagramLive}
                />
              </SocialOptions>
              <SocialActions>
                <Button
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
                  variant="primary"
                >
                  <ButtonIcon name="link" />
                  Update Instagram settings
                </Button>
              </SocialActions>
            </>
          ) : (
            <SocialActions>
              <a
                href={`${apiUrl}/api/me/social/instagram/oauth/start`}
                className="ui-btn ui-btn--primary"
              >
                <ButtonIcon name="link" />
                Connect Instagram account
              </a>
            </SocialActions>
          )}
        </PlatformSection>
      </div>
    </Panel>
  )
}
