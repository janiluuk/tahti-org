// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { ButtonIcon, Button, Panel } from '@tahti/ui'
import { updateChannelProfile } from '../../channel-identity-actions'
import ChannelIdentityPanel, { type ChannelIdentityDraft } from '../../channel-identity-panel'
import ChannelBioPanel from '../../channel-bio-panel'
import ChannelLinksPanel, { type ChannelLink } from '../../channel-links-panel'

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
        title="Links"
        description="Where else listeners can find you — shown on your channel page."
      >
        <ChannelLinksPanel initial={links} onDraftChange={setLinks} />
      </Panel>
    </div>
  )
}
