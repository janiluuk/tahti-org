// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

export default function ProEditorLayout({ children }: { children: ReactNode }) {
  return <div className="pro-editor-fullpage">{children}</div>
}
