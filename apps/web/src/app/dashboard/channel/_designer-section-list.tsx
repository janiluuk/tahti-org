// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { DesignerSectionDefinition, DesignerSectionId } from './_designer-sections'

export function DesignerSectionList({
  sections,
  activeId,
  onSelect,
}: {
  sections: DesignerSectionDefinition[]
  activeId: DesignerSectionId
  onSelect: (id: DesignerSectionId) => void
}) {
  return (
    <nav className="studio-designer-section-list" aria-label="Design sections">
      {sections.map((section) => {
        const active = section.id === activeId
        return (
          <button
            key={section.id}
            type="button"
            className={`studio-designer-section-list__item${active ? ' studio-designer-section-list__item--active' : ''}`}
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(section.id)}
          >
            {section.navLabel}
          </button>
        )
      })}
    </nav>
  )
}
