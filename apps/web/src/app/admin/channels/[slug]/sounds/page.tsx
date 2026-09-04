// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import '@tahti/ui/src/styles/brand-studio.css'
import { fetchAdminChannelSound } from './actions'
import { AdminSoundEditor } from './_admin-sound-editor'
import { resolveChannelUrl } from '@/lib/app-url'

export default async function AdminChannelSoundPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const { data, error } = await fetchAdminChannelSound(slug)

  return (
    <>
      <p className="admin-stat-sub" style={{ marginBottom: '0.5rem' }}>
        <Link href={resolveChannelUrl(slug)} target="_blank" rel="noopener noreferrer">
          View channel ↗
        </Link>
      </p>
      <h1 className="admin-section-title">
        {slug}
        &apos;s music
      </h1>

      {error || !data ? (
        <p className="admin-stat-sub">{error ?? 'Channel not found.'}</p>
      ) : data.length === 0 ? (
        <p className="admin-stat-sub">No archive items yet.</p>
      ) : (
        <div className="admin-sound-list">
          {data.map((item) => (
            <AdminSoundEditor key={item.id} slug={slug} item={item} />
          ))}
        </div>
      )}
    </>
  )
}
