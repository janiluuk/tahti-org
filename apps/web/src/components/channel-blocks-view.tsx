// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { packChannelBlocks, type PublicChannelBlock } from '@tahti/shared'
import { AddonFrame } from '@/components/addons/addon-frame'

export function ChannelBlocksView({
  blocks,
  preview = false,
}: {
  blocks: PublicChannelBlock[]
  /** Studio live preview — skip sandboxed iframes, show addon name instead. */
  preview?: boolean
}) {
  const rows = packChannelBlocks(blocks)
  if (rows.length === 0) return null

  return (
    <section className="ch-block-rows" aria-label="Channel blocks">
      {rows.map((row) => (
        <div key={row.map((block) => block.id).join('-')} className="ch-block-row">
          {row.map((block) => (
            <div key={block.id} className={`ch-block ch-block--${block.width.toLowerCase()}`}>
              {block.type === 'LOGO' && block.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- artist-uploaded CDN URL
                <img src={block.logoUrl} alt="" className="ch-block-logo" />
              ) : block.addon && !preview ? (
                <AddonFrame
                  sandboxUrl={block.addon.sandboxUrl}
                  name={block.addon.name}
                  context={block.addon.context}
                  config={block.addon.config}
                />
              ) : block.addon ? (
                <div className="ch-block-addon-preview">{block.addon.name}</div>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
