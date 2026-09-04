// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Select } from '@tahti/ui'
import type { DesignerSectionDefinition, DesignerSectionId } from './_designer-sections'

export function DesignerSectionSelect({
  sections,
  activeId,
  onSelect,
}: {
  sections: DesignerSectionDefinition[]
  activeId: DesignerSectionId
  onSelect: (id: DesignerSectionId) => void
}) {
  return (
    <label className="studio-designer-section-select">
      <span className="studio-label">Section</span>
      <Select
        value={activeId}
        aria-label="Design section"
        onChange={(e) => onSelect(e.target.value as DesignerSectionId)}
      >
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.navLabel}
          </option>
        ))}
      </Select>
    </label>
  )
}
