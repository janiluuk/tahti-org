'use client'

import type { ReactNode } from 'react'
import type { VisualPreset } from '@tahti/shared'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'

export function ProfileCoverVisual({ preset, children }: { preset?: string; children: ReactNode }) {
  return (
    <div className="prof-cover-visual">
      {preset && (
        <ChannelVisualizer preset={preset as VisualPreset} className="prof-cover-visual__fx" />
      )}
      {children}
    </div>
  )
}
