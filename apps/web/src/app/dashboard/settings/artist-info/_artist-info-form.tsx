// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ButtonIcon, Button, Panel } from '@tahti/ui'
import type { ArtistKind, AvatarTheme, ChannelMemberView, LogoPlacement } from '@tahti/shared'
import { updateChannelProfile } from '../../channel-identity-actions'
import ChannelIdentityPanel, { type ChannelIdentityDraft } from '../../channel-identity-panel'
import ChannelBioPanel from '../../channel-bio-panel'
import type { ChannelLink } from '../../channel-links-panel'
import { MembersPanel } from '../members/_members-panel'

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
  avatarPosterUrl: string | null
  avatarTheme: AvatarTheme | null
  logoUrl: string | null
  logoPlacement: LogoPlacement | null
  countryCode: string | null
  pronouns: string | null
  showJoinDate: boolean
  showFollowers: boolean
  showFollowing: boolean
  showDailyListeners: boolean
  chatEnabled: boolean
  defaultLocation: string | null
  genres: string[]
  bio: string
  links: ChannelLink[]
  streamingLinks: StreamingLinksDraft
  artistKind: ArtistKind
}

export function ArtistInfoForm({
  initial,
  initialMembers,
}: {
  initial: ArtistInfoFormData
  initialMembers: ChannelMemberView[]
}) {
  const [identity, setIdentity] = useState<ChannelIdentityDraft>({
    displayName: initial.displayName,
    avatarUrl: initial.avatarUrl,
    avatarPosterUrl: initial.avatarPosterUrl,
    avatarTheme: initial.avatarTheme,
    logoUrl: initial.logoUrl,
    logoPlacement: initial.logoPlacement,
    countryCode: initial.countryCode,
    pronouns: initial.pronouns,
    defaultLocation: initial.defaultLocation,
    genres: initial.genres,
  })
  const [bio, setBio] = useState(initial.bio)
  const [showJoinDate, setShowJoinDate] = useState(initial.showJoinDate)
  const [showFollowers, setShowFollowers] = useState(initial.showFollowers)
  const [showFollowing, setShowFollowing] = useState(initial.showFollowing)
  const [showDailyListeners, setShowDailyListeners] = useState(initial.showDailyListeners)
  const [chatEnabled, setChatEnabled] = useState(initial.chatEnabled)
  const [artistKind, setArtistKind] = useState<ArtistKind>(initial.artistKind)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      // socialLinks is a full replace — preserve streaming/links owned by Connections.
      const res = await updateChannelProfile({
        displayName: identity.displayName,
        bio,
        avatarUrl: identity.avatarUrl,
        avatarPosterUrl: identity.avatarPosterUrl,
        avatarTheme: identity.avatarTheme,
        logoUrl: identity.logoUrl,
        logoPlacement: identity.logoPlacement,
        countryCode: identity.countryCode,
        pronouns: identity.pronouns,
        showJoinDate,
        showFollowers,
        showFollowing,
        showDailyListeners,
        chatEnabled,
        defaultLocation: identity.defaultLocation,
        artistKind,
        socialLinks: {
          genres: identity.genres.join(', '),
          youtube: initial.streamingLinks.youtube.trim(),
          hearthisAt: initial.streamingLinks.hearthisAt.trim(),
          twitch: initial.streamingLinks.twitch.trim(),
          soundcloud: initial.streamingLinks.soundcloud.trim(),
          kick: initial.streamingLinks.kick.trim(),
          ...linksToSocialLinks(initial.links),
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

      <Panel title="Act type" description="Are you a solo artist (e.g. DJ) or a collective / band?">
        <div className="studio-kind-toggle" role="radiogroup" aria-label="Act type">
          <label
            className={`studio-kind-toggle__option${artistKind === 'SINGLE' ? ' studio-kind-toggle__option--active' : ''}`}
          >
            <input
              type="radio"
              name="artistKind"
              value="SINGLE"
              checked={artistKind === 'SINGLE'}
              onChange={() => setArtistKind('SINGLE')}
            />
            <span className="studio-kind-toggle__title">Single artist</span>
            <span className="studio-kind-toggle__hint">Solo DJ, producer, or performer</span>
          </label>
          <label
            className={`studio-kind-toggle__option${artistKind === 'COLLECTIVE' ? ' studio-kind-toggle__option--active' : ''}`}
          >
            <input
              type="radio"
              name="artistKind"
              value="COLLECTIVE"
              checked={artistKind === 'COLLECTIVE'}
              onChange={() => setArtistKind('COLLECTIVE')}
            />
            <span className="studio-kind-toggle__title">Collective</span>
            <span className="studio-kind-toggle__hint">Band, duo, label, or crew</span>
          </label>
        </div>
      </Panel>

      <div id="members">
        <MembersPanel initialMembers={initialMembers} artistKind={artistKind} />
      </div>

      <Panel
        title="Visibility"
        description="What shows on your public profile — everything defaults to visible."
      >
        <label className="studio-toggle-row">
          <input
            type="checkbox"
            className="studio-toggle-checkbox"
            checked={showJoinDate}
            onChange={(e) => setShowJoinDate(e.target.checked)}
          />
          <span className="studio-toggle-label">Show join date on my profile</span>
        </label>
        <p className="studio-text-muted-sm studio-mt-xs">
          Displays &ldquo;Member since {new Date().getFullYear()}&rdquo; on your public profile and
          channel page.
        </p>
        <label className="studio-toggle-row studio-mt-sm">
          <input
            type="checkbox"
            className="studio-toggle-checkbox"
            checked={showFollowers}
            onChange={(e) => setShowFollowers(e.target.checked)}
          />
          <span className="studio-toggle-label">Show my followers on my profile</span>
        </label>
        <label className="studio-toggle-row studio-mt-sm">
          <input
            type="checkbox"
            className="studio-toggle-checkbox"
            checked={showFollowing}
            onChange={(e) => setShowFollowing(e.target.checked)}
          />
          <span className="studio-toggle-label">Show who I follow on my profile</span>
        </label>
        <label className="studio-toggle-row studio-mt-sm">
          <input
            type="checkbox"
            className="studio-toggle-checkbox"
            checked={showDailyListeners}
            onChange={(e) => setShowDailyListeners(e.target.checked)}
          />
          <span className="studio-toggle-label">Show today’s listener count in my chat</span>
        </label>
        <label className="studio-toggle-row studio-mt-sm">
          <input
            type="checkbox"
            className="studio-toggle-checkbox"
            checked={chatEnabled}
            onChange={(e) => setChatEnabled(e.target.checked)}
          />
          <span className="studio-toggle-label">Enable live chat on my channel</span>
        </label>
        <p className="studio-text-muted-sm studio-mt-xs">
          Hides the chat panel from your channel page entirely. Turn it back on any time.
        </p>
      </Panel>

      <Panel title="Bio">
        <ChannelBioPanel initial={{ bio }} onDraftChange={setBio} />
      </Panel>

      <p className="studio-text-muted-sm">
        Streaming platforms, profile links, and connected accounts are under{' '}
        <Link href="/dashboard/settings/connections" className="studio-link">
          Connections
        </Link>
        .
      </p>
    </div>
  )
}
