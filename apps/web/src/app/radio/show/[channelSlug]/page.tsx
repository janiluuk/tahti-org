// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AvatarTile, ChannelHeader, Heading, Row, SafePlainText, Text } from '@tahti/ui'
import { getSessionUser } from '@/lib/session'
import { renderBio } from '@/lib/render-bio'
import { fetchRadioShow, type RadioShowEpisode } from '../../actions'
import { formatShowTime } from '../../upcoming-shows'
import { ShowOwnerGoLiveCta } from './_owner-go-live-cta'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channelSlug: string }>
}): Promise<Metadata> {
  const { channelSlug } = await params
  const show = await fetchRadioShow(channelSlug)
  if (!show) return { title: 'Show not found — Tahti Radio' }
  return {
    title: `${show.artist.displayName} on Tahti Radio`,
    description: show.artist.bio ?? `${show.artist.displayName}'s show on Tahti Radio.`,
  }
}

function EpisodeList({ episodes, emptyText }: { episodes: RadioShowEpisode[]; emptyText: string }) {
  if (episodes.length === 0) {
    return <p className="ch-radio-upcoming__note">{emptyText}</p>
  }
  return (
    <ul className="ch-radio-upcoming__list">
      {episodes.map((ep) => (
        <li key={ep.id} className="ch-radio-upcoming__item">
          <div className="ch-radio-upcoming__body">
            <span className="ch-radio-upcoming__artist">
              {formatShowTime(ep.startAt)}
              {ep.showType === 'TALK' ? ' · Talk' : ''}
            </span>
            {ep.note && <span className="ch-radio-upcoming__note">{ep.note}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default async function RadioShowPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>
}) {
  const { channelSlug } = await params
  const [show, user] = await Promise.all([fetchRadioShow(channelSlug), getSessionUser()])
  if (!show) notFound()

  const bioHtml = show.artist.bio ? await renderBio(show.artist.bio) : null
  const isShowOwner = user?.channelSlug != null && user.channelSlug === show.artist.channelSlug

  return (
    <>
      <ChannelHeader activeNav="radio" user={user} />
      <div className="ch-body shell-channel">
        <div className="ch-main">
          <div className="ch-page-content">
            <div className="ch-page-foreground">
              <header className="ch-artist-header">
                <Row className="ui-row--gap-3 ch-artist-header-row">
                  <AvatarTile
                    size="sm"
                    name={show.artist.displayName}
                    src={show.artist.avatarUrl}
                    className="ch-artist-avatar"
                  />
                  <div>
                    <Heading level={1} className="ch-artist-name">
                      {show.artist.displayName}
                    </Heading>
                    <Text size="sm" tone="muted">
                      Show on <Link href="/radio">Tahti Radio</Link>
                      {' · '}
                      <Link href={`/u/${show.artist.username}`}>view artist profile</Link>
                    </Text>
                    {(show.nextShowAt || show.lastShowAt) && (
                      <Text size="sm" tone="muted" className="ch-radio-show-meta">
                        {show.nextShowAt ? `Next ${formatShowTime(show.nextShowAt)}` : null}
                        {show.nextShowAt && show.lastShowAt ? ' · ' : null}
                        {show.lastShowAt ? `Last ${formatShowTime(show.lastShowAt)}` : null}
                      </Text>
                    )}
                    {isShowOwner && user ? (
                      <ShowOwnerGoLiveCta
                        initialChannelState={user.channelState}
                        episodes={show.upcomingEpisodes.map((ep) => ({
                          startAt: ep.startAt,
                          endAt: ep.endAt,
                        }))}
                      />
                    ) : null}
                  </div>
                </Row>
                {bioHtml ? (
                  <div
                    className="ch-artist-bio ch-artist-bio--rich"
                    dangerouslySetInnerHTML={{ __html: bioHtml }}
                  />
                ) : show.artist.bio ? (
                  <div className="ch-artist-bio">
                    <SafePlainText text={show.artist.bio} />
                  </div>
                ) : null}
              </header>

              <section className="ch-radio-upcoming">
                <h2 className="ch-radio-upcoming__title">Upcoming schedule</h2>
                <EpisodeList
                  episodes={show.upcomingEpisodes}
                  emptyText="No upcoming slots booked right now."
                />
              </section>

              <section className="ch-radio-upcoming">
                <h2 className="ch-radio-upcoming__title">Past episodes</h2>
                <EpisodeList episodes={show.pastEpisodes} emptyText="Nothing has aired yet." />
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
