// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AvatarTile, ButtonIcon, Button, Panel, StudioTabs } from '@tahti/ui'
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
    <div className="artist-info-shell">
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

      <section className="artist-info-summary" aria-label="Artist profile preview">
        <AvatarTile
          size="lg"
          name={identity.displayName || initial.displayName}
          src={identity.avatarPosterUrl ?? identity.avatarUrl}
          bordered
        />
        <div className="artist-info-summary__copy">
          <span className="artist-info-summary__eyebrow">Public identity</span>
          <h2>{identity.displayName || 'Untitled artist'}</h2>
          <p>
            {[identity.defaultLocation, ...identity.genres.slice(0, 3)]
              .filter(Boolean)
              .join(' · ') || 'Add a location and a few genres to sharpen your profile.'}
          </p>
        </div>
        <span className="artist-info-summary__kind">
          {artistKind === 'COLLECTIVE' ? 'Collective' : 'Solo artist'}
        </span>
      </section>

      <StudioTabs
        defaultTab="identity"
        syncHash
        hashAliases={{ members: 'people' }}
        className="artist-info-tabs"
      >
        <StudioTabs.List aria-label="Artist info sections">
          <StudioTabs.Trigger value="identity">Identity</StudioTabs.Trigger>
          <StudioTabs.Trigger value="story">Story</StudioTabs.Trigger>
          <StudioTabs.Trigger value="people">People</StudioTabs.Trigger>
        </StudioTabs.List>

        <StudioTabs.Panel value="identity">
          <Panel
            title="Identity"
            description="Name, image, logo, location, and the genres that define you."
          >
            <div className="artist-info-identity-fields">
              <ChannelIdentityPanel initial={identity} onDraftChange={setIdentity} />
            </div>
          </Panel>
        </StudioTabs.Panel>

        <StudioTabs.Panel value="story">
          <Panel
            title="Biography"
            description="Keep it memorable. Lead with what makes the project distinct."
          >
            <ChannelBioPanel initial={{ bio }} onDraftChange={setBio} />
          </Panel>
        </StudioTabs.Panel>

        <StudioTabs.Panel value="people">
          <Panel title="Project type" headerTight>
            <div className="artist-info-kind" role="radiogroup" aria-label="Act type">
              <label className={artistKind === 'SINGLE' ? 'is-active' : undefined}>
                <input
                  type="radio"
                  name="artistKind"
                  value="SINGLE"
                  checked={artistKind === 'SINGLE'}
                  onChange={() => setArtistKind('SINGLE')}
                />
                <span>Solo artist</span>
                <small>DJ, producer, or performer</small>
              </label>
              <label className={artistKind === 'COLLECTIVE' ? 'is-active' : undefined}>
                <input
                  type="radio"
                  name="artistKind"
                  value="COLLECTIVE"
                  checked={artistKind === 'COLLECTIVE'}
                  onChange={() => setArtistKind('COLLECTIVE')}
                />
                <span>Collective</span>
                <small>Band, duo, label, or crew</small>
              </label>
            </div>
          </Panel>
          <div id="members" className="artist-info-members">
            <MembersPanel initialMembers={initialMembers} artistKind={artistKind} />
          </div>
        </StudioTabs.Panel>
      </StudioTabs>

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
