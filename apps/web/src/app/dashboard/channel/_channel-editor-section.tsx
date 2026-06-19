// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

export function ChannelEditorSection({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="studio-channel-editor__section">
      <header className="studio-channel-editor__section-header">
        <h2 className="studio-channel-editor__section-title">{title}</h2>
        {description ? (
          <div className="studio-channel-editor__section-desc">{description}</div>
        ) : null}
      </header>
      <div className="studio-channel-editor__section-body">{children}</div>
    </section>
  )
}
