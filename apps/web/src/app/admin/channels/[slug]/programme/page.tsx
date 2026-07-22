// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import '@tahti/ui/src/styles/brand-studio.css'
import { RotationEditor } from '../../../../dashboard/schedule/_rotation-editor'
import {
  addAdminLibraryTrack,
  fetchAdminChannelProgramme,
  updateAdminChannelProgramme,
} from './actions'

export default async function AdminChannelProgrammePage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const { data, error } = await fetchAdminChannelProgramme(slug)

  return (
    <>
      <p className="admin-stat-sub" style={{ marginBottom: '0.5rem' }}>
        <Link href={`/c/${slug}`} target="_blank" rel="noopener noreferrer">
          View channel ↗
        </Link>
      </p>
      <h1 className="admin-section-title">
        {slug}
        &apos;s 24/7 playlist
      </h1>

      {error || !data ? (
        <p className="admin-stat-sub">{error ?? 'Channel not found.'}</p>
      ) : (
        <RotationEditor
          initial={data}
          channelSlug={slug}
          updateProgramme={updateAdminChannelProgramme.bind(null, slug)}
          addLibraryTrack={addAdminLibraryTrack.bind(null, slug)}
        />
      )}
    </>
  )
}
