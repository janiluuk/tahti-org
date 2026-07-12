// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { ButtonIcon, Button, Panel } from '@tahti/ui'
import { updateChannelProfile } from '../../channel-identity-actions'
import ChannelIdentityPanel, { type ChannelIdentityDraft } from '../../channel-identity-panel'
import ChannelBioPanel from '../../channel-bio-panel'
import ChannelLinksPanel, { type ChannelLink } from '../../channel-links-panel'
import { SocialLinkIcon } from '@/components/social-link-icon'

export interface StreamingLinksDraft {
  youtube: string
  hearthisAt: string
  twitch: string
  soundcloud: string
  kick: string
}

function linksToSocialLinks(links: ChannelLink[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const { label, url } of links) {
    const key = label.trim()
    if (key && url.trim()) map[key] = url.trim()
  }
  return map
}

export interface ArtistInfoFormData {
  displayName: string
  avatarUrl: string | null
  countryCode: string | null
  pronouns: string | null
  genres: string[]
  bio: string
  links: ChannelLink[]
  streamingLinks: StreamingLinksDraft
}

export function ArtistInfoForm({ initial }: { initial: ArtistInfoFormData }) {
  const [identity, setIdentity] = useState<ChannelIdentityDraft>({
    displayName: initial.displayName,
    avatarUrl: initial.avatarUrl,
    countryCode: initial.countryCode,
    pronouns: initial.pronouns,
    genres: initial.genres,
  })
  const [bio, setBio] = useState(initial.bio)
  const [links, setLinks] = useState<ChannelLink[]>(initial.links)
  const [streamingLinks, setStreamingLinks] = useState<StreamingLinksDraft>(initial.streamingLinks)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await updateChannelProfile({
        displayName: identity.displayName,
        bio,
        avatarUrl: identity.avatarUrl ?? undefined,
        countryCode: identity.countryCode,
        pronouns: identity.pronouns,
        socialLinks: {
          genres: identity.genres.join(', '),
          youtube: streamingLinks.youtube.trim(),
          hearthisAt: streamingLinks.hearthisAt.trim(),
          twitch: streamingLinks.twitch.trim(),
          soundcloud: streamingLinks.soundcloud.trim(),
          kick: streamingLinks.kick.trim(),
          ...linksToSocialLinks(links),
        },
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('Artist info saved.')
    })
  }

  return (
    <div className="studio-settings-stack">
      <div className="studio-channel-editor__publish-bar">
        <div className="studio-channel-editor__publish-bar-notice">
          {error && <p className="studio-notice studio-notice--error">{error}</p>}
          {message && <p className="studio-notice studio-notice--success">{message}</p>}
        </div>
        <Button onClick={save} disabled={isPending} variant="primary">
          <ButtonIcon name="save" />
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <Panel
        title="Artist identity"
        description="Who you are — shown at the top of your channel page."
      >
        <ChannelIdentityPanel initial={identity} onDraftChange={setIdentity} />
      </Panel>

      <Panel title="Bio">
        <ChannelBioPanel initial={{ bio }} onDraftChange={setBio} />
      </Panel>

      <Panel
        title="Streaming platforms"
        description="Your channels on other platforms — shown in their own section on your profile."
      >
        <div className="studio-field--block">
          <div className="studio-row studio-row--wrap studio-mb-sm">
            <span className="studio-link-row__icon">
              <SocialLinkIcon label="YouTube" url={streamingLinks.youtube} />
            </span>
            <input
              type="url"
              placeholder="YouTube channel URL"
              value={streamingLinks.youtube}
              onChange={(e) => setStreamingLinks((prev) => ({ ...prev, youtube: e.target.value }))}
              className="studio-input studio-input--grow"
              maxLength={2000}
            />
          </div>
          <div className="studio-row studio-row--wrap studio-mb-sm">
            <span className="studio-link-row__icon">
              <SocialLinkIcon label="hearthis.at" url={streamingLinks.hearthisAt} />
            </span>
            <input
              type="url"
              placeholder="hearthis.at profile URL"
              value={streamingLinks.hearthisAt}
              onChange={(e) =>
                setStreamingLinks((prev) => ({ ...prev, hearthisAt: e.target.value }))
              }
              className="studio-input studio-input--grow"
              maxLength={2000}
            />
          </div>
          <div className="studio-row studio-row--wrap studio-mb-sm">
            <span className="studio-link-row__icon">
              <SocialLinkIcon label="Twitch" url={streamingLinks.twitch} />
            </span>
            <input
              type="url"
              placeholder="Twitch channel URL"
              value={streamingLinks.twitch}
              onChange={(e) => setStreamingLinks((prev) => ({ ...prev, twitch: e.target.value }))}
              className="studio-input studio-input--grow"
              maxLength={2000}
            />
          </div>
          <div className="studio-row studio-row--wrap studio-mb-sm">
            <span className="studio-link-row__icon">
              <SocialLinkIcon label="SoundCloud" url={streamingLinks.soundcloud} />
            </span>
            <input
              type="url"
              placeholder="SoundCloud profile URL"
              value={streamingLinks.soundcloud}
              onChange={(e) =>
                setStreamingLinks((prev) => ({ ...prev, soundcloud: e.target.value }))
              }
              className="studio-input studio-input--grow"
              maxLength={2000}
            />
          </div>
          <div className="studio-row studio-row--wrap studio-mb-sm">
            <span className="studio-link-row__icon">
              <SocialLinkIcon label="Kick" url={streamingLinks.kick} />
            </span>
            <input
              type="url"
              placeholder="Kick channel URL"
              value={streamingLinks.kick}
              onChange={(e) => setStreamingLinks((prev) => ({ ...prev, kick: e.target.value }))}
              className="studio-input studio-input--grow"
              maxLength={2000}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Links"
        description="Where else listeners can find you — shown on your channel page."
      >
        <ChannelLinksPanel initial={links} onDraftChange={setLinks} />
      </Panel>
    </div>
  )
}
