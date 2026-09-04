// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { AddonInstallView, ChannelBlockView } from '@tahti/shared'

/** One-line description shown in the Brand blocks list row -- the asset URL
 * for a LOGO block, or the referenced add-on's name for an ADDON block. */
export function channelBlockSummary(
  block: ChannelBlockView,
  addonInstalls: AddonInstallView[],
): string {
  if (block.type === 'LOGO') {
    const assetUrl = (block.configJson as { assetUrl?: string } | null)?.assetUrl
    return assetUrl ? assetUrl : 'No image set yet'
  }
  const addonInstallId = (block.configJson as { addonInstallId?: string } | null)?.addonInstallId
  const install = addonInstalls.find((i) => i.id === addonInstallId)
  return install ? install.widget.name : 'Add-on not found'
}

/** Add-on installs not already referenced by a block -- what's left to offer
 * in the "Add an add-on block" picker. */
export function unblockedAddonInstalls(
  addonInstalls: AddonInstallView[],
  blocks: ChannelBlockView[],
): AddonInstallView[] {
  return addonInstalls.filter(
    (install) =>
      !blocks.some(
        (block) =>
          block.type === 'ADDON' &&
          (block.configJson as { addonInstallId?: string } | null)?.addonInstallId === install.id,
      ),
  )
}
