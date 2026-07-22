// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, type ReactElement, type ReactNode } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import type { DragEndEvent } from '@dnd-kit/react'

export interface SortableItemHandle {
  /** Attach to the element that should move/register as the sortable node. */
  ref: (element: Element | null) => void
  /** Attach to a drag handle within the item; omit to make the whole item draggable. */
  handleRef: (element: Element | null) => void
  isDragging: boolean
}

export interface SortableListProps<T> {
  items: T[]
  /** Stable unique id for each item — used to track identity across reorders. */
  itemId: (item: T) => string
  /** Called with the reordered array as soon as a drag finishes (source moved to target index). */
  onReorder: (next: T[]) => void
  renderItem: (item: T, index: number, sortable: SortableItemHandle) => ReactNode
  /** Optional group id — items only reorder within the same group. */
  group?: string
  as?: 'ul' | 'ol' | 'div'
  className?: string
  /** Extra static content rendered after the sortable items, inside the same container. */
  children?: ReactNode
}

/**
 * Drag-reorderable list built on @dnd-kit/react. Renders `as` (default `div`) as the
 * container and lets `renderItem` return the actual list-item element, attaching
 * `sortable.ref` (and optionally `sortable.handleRef`) itself.
 */
export function SortableList<T>({
  items,
  itemId,
  onReorder,
  renderItem,
  group,
  as: Tag = 'div',
  className,
  children,
}: SortableListProps<T>): ReactElement {
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { source, target } = event.operation
      if (!source || !target || source.id === target.id) return
      const fromIndex = items.findIndex((item) => itemId(item) === String(source.id))
      const toIndex = items.findIndex((item) => itemId(item) === String(target.id))
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
      const next = [...items]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved!)
      onReorder(next)
    },
    [items, itemId, onReorder],
  )

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <Tag className={className}>
        {items.map((item, index) => (
          <SortableListItem key={itemId(item)} id={itemId(item)} index={index} group={group}>
            {(sortable) => renderItem(item, index, sortable)}
          </SortableListItem>
        ))}
        {children}
      </Tag>
    </DragDropProvider>
  )
}

function SortableListItem({
  id,
  index,
  group,
  children,
}: {
  id: string
  index: number
  group?: string
  children: (sortable: SortableItemHandle) => ReactNode
}): ReactNode {
  const { ref, handleRef, isDragging } = useSortable({ id, index, group })
  return children({ ref, handleRef, isDragging })
}
