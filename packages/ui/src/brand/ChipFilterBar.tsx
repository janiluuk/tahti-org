'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useRef, useState } from 'react'
import { MobileNavSheet } from './MobileNavSheet'

export type ChipFilterOption = {
  value: string
  label: string
}

export type ChipFilterBarProps = {
  label: string
  value: string | null
  options: ChipFilterOption[]
  allLabel?: string
  onChange: (value: string | null) => void
}

function ChipButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`chip-filter-bar__chip${active ? ' chip-filter-bar__chip--active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Desktop: wrap-all chips. Mobile: current value + Filters sheet. */
export function ChipFilterBar({
  label,
  value,
  options,
  allLabel = 'All',
  onChange,
}: ChipFilterBarProps) {
  const [open, setOpen] = useState(false)
  const filtersRef = useRef<HTMLButtonElement>(null)
  const currentLabel = options.find((option) => option.value === value)?.label ?? allLabel

  function select(next: string | null) {
    onChange(next)
    setOpen(false)
  }

  function renderChips() {
    return (
      <>
        <ChipButton active={value === null} onClick={() => select(null)}>
          {allLabel}
        </ChipButton>
        {options.map((option) => (
          <ChipButton
            key={option.value}
            active={value === option.value}
            onClick={() => select(option.value === value ? null : option.value)}
          >
            {option.label}
          </ChipButton>
        ))}
      </>
    )
  }

  return (
    <div className="chip-filter-bar">
      <div className="chip-filter-bar__desktop" role="group" aria-label={label}>
        {renderChips()}
      </div>
      <div className="chip-filter-bar__compact">
        <div className="chip-filter-bar__current">
          <small>{label}</small>
          <span>{currentLabel}</span>
        </div>
        <button
          ref={filtersRef}
          type="button"
          className="chip-filter-bar__filters"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          Filters
        </button>
      </div>
      <MobileNavSheet
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={filtersRef}
        ariaLabel={label}
        closeLabel="Close filters"
      >
        <div className="chip-filter-bar__sheet" role="group" aria-label={label}>
          {renderChips()}
        </div>
      </MobileNavSheet>
    </div>
  )
}
