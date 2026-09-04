// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { packBlocks, type ChannelBlockRenderItem } from '@tahti/shared'
import { AddonFrame } from '@/components/addons/addon-frame'

const WIDTH_PERCENT: Record<ChannelBlockRenderItem['width'], string> = {
  FULL: '100%',
  HALF: 'calc(50% - 0.5rem)',
  THIRD: 'calc(33.333% - 0.667rem)',
}

/** Renders an artist's Channel Designer "Brand blocks" (logo images, placed
 * add-ons) on their public profile, packed into rows the same way the
 * editor preview would (see packBlocks in @tahti/shared -- both import the
 * identical function so the two can never drift). */
export function ChannelBlocksSection({ blocks }: { blocks: ChannelBlockRenderItem[] }) {
  if (blocks.length === 0) return null

  const rows = packBlocks(blocks)

  return (
    <section className="prof-section">
      <div className="prof-sec-label">Brand blocks</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            {row.map((block) => (
              <div key={block.id} style={{ flex: `0 0 ${WIDTH_PERCENT[block.width]}` }}>
                {block.type === 'LOGO' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={block.assetUrl}
                    alt=""
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                ) : (
                  <AddonFrame
                    sandboxUrl={block.addon.sandboxUrl}
                    name={block.addon.name}
                    context={block.addon.context}
                    config={block.addon.config}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
