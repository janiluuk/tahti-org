// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { ButtonIcon, Button, Panel } from '@tahti/ui'
import { updateChannelProfile } from '../../channel-identity-actions'
import ChannelLinksPanel, { type ChannelLink } from '../../channel-links-panel'
import { SocialLinkIcon } from '@/components/social-link-icon'
import type { StreamingLinksDraft } from '../artist-info/_artist-info-form'

function linksToSocialLinks(links: ChannelLink[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const { label, url } of links) {
    const key = label.trim()
    if (key && url.trim()) map[key] = url.trim()
  }
  return map
}

export function ConnectionsForm({
  initial,
  genresCsv,
  children,
}: {
  initial: {
    links: ChannelLink[]
    streamingLinks: StreamingLinksDraft
  }
  /** Preserved on save — genres live under Artist info but share socialLinks. */
  genresCsv: string
  children?: ReactNode
}) {
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
        socialLinks: {
          genres: genresCsv,
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
      setMessage('Connections saved.')
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

      {children}
    </div>
  )
}
