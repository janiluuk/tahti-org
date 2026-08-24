// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Reference Disco-widget (ARTIST scope): shows whether the channel is live
// right now. Build with `pnpm --filter @tahti/widget-sdk run
// build:example:live-status`, then upload dist/bundle.js via the admin
// catalog flow described in ../../README.md.

import { mountDiscoWidget } from '../../../src/index.js'
import type { DiscoWidgetModule } from '../../../src/index.js'

interface LiveStatusContext {
  channelSlug: string
  displayName: string
  isLive: boolean
}

const widget: DiscoWidgetModule = {
  async mount(container, host) {
    const context = await host.getContext<LiveStatusContext>()

    const root = document.createElement('div')
    root.style.cssText =
      'font-family: system-ui, sans-serif; padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; gap: 8px;'

    const dot = document.createElement('span')
    dot.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background: ${
      context.isLive ? '#22c55e' : '#6b7280'
    };`

    const label = document.createElement('span')
    label.textContent = context.isLive
      ? `${context.displayName} is live now`
      : `${context.displayName} is offline`

    root.append(dot, label)
    container.appendChild(root)

    host.resize(root.scrollHeight + 24)
  },
  unmount() {},
}

mountDiscoWidget(widget)
