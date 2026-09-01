// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'

/** Text overlay editing moved into the channel design page as its own
 * section — see _channel-editor-sections.tsx (#channel-text-overlay). Keep
 * this URL working for old bookmarks/links, same as the gallery redirect. */
export default function ChannelTextRedirect() {
  redirect('/dashboard/channel/edit#channel-text-overlay')
}
