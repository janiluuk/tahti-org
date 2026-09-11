// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="pro-editor-switch"
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    >
      <span className="pro-editor-switch__thumb" aria-hidden />
    </button>
  )
}

export function ChainTile({
  position,
  name,
  summary,
  enabled,
  focused,
  onFocus,
  onToggle,
}: {
  position: number
  name: string
  summary: string
  enabled: boolean
  focused: boolean
  onFocus: () => void
  onToggle: (v: boolean) => void
}) {
  // A plain <button> wrapper here would nest the Switch's own <button> inside
  // it — invalid HTML that breaks the toggle's click handling (the browser's
  // parser can't nest interactive controls, so the switch never receives its
  // own clicks). Use a div with button semantics for the focus target instead,
  // so the toggle stays a real, independently-clickable button inside it.
  return (
    <div
      role="button"
      tabIndex={0}
      className={cx('plug', focused && 'plug--focused', !enabled && 'plug--bypassed')}
      onClick={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onFocus()
        }
      }}
    >
      <div className="plug__head">
        <span className="plug__name">
          <span
            className={cx('plug__status-dot', enabled && 'plug__status-dot--enabled')}
            aria-hidden
          />
          {position} · {name}
        </span>
        <Switch checked={enabled} onChange={onToggle} label={`${name} enabled`} />
      </div>
      <div className="plug__summary plug__mono-summary">{summary}</div>
    </div>
  )
}
