// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

export interface StudioSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** Visually-hidden accessible name — the switch has no visible label of its own. */
  label: string
  className?: string
}

/** Pill-shaped on/off switch used across the studio dashboard wherever a checkbox reads as a
 * toggle rather than a selection (e.g. "enable the visualizer", "show embeds in this list"). */
export function StudioSwitch({ checked, onChange, disabled, label, className }: StudioSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`studio-switch${className ? ` ${className}` : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="studio-switch__thumb" aria-hidden />
      <span className="studio-sr-only">{label}</span>
    </button>
  )
}
