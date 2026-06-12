// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { cn } from '../lib/cn'

const ANGLE_START = -135
const ANGLE_RANGE = 270

export interface KnobProps {
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  color?: string
  label?: string
  defaultValue?: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
  className?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function quantize(value: number, min: number, max: number, step: number): number {
  return clamp(Math.round(value / step) * step, min, max)
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  if (Math.abs(endAngle - startAngle) < 0.001) return ''
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

/**
 * Rotary control: drag = coarse, ⌥/Ctrl-drag = fine (10x), scroll = step,
 * double-click value = type, double-click knob = reset.
 */
export function Knob({
  value,
  min,
  max,
  step = 0.1,
  unit = '',
  color = 'var(--cyan)',
  label,
  defaultValue,
  onChange,
  formatValue,
  className,
}: KnobProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)

  const setValue = useCallback(
    (next: number) => onChange(quantize(next, min, max, step)),
    [onChange, min, max, step],
  )

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editing) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, startValue: value }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const dy = dragRef.current.startY - e.clientY
    const fine = e.altKey || e.ctrlKey
    const range = max - min
    const sensitivity = (fine ? range / 2000 : range / 200) || step
    setValue(dragRef.current.startValue + dy * sensitivity)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    dragRef.current = null
  }

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const fine = e.altKey || e.ctrlKey
    const delta = e.deltaY > 0 ? -step : step
    setValue(value + (fine ? delta / 10 : delta))
  }

  const openEditor = () => {
    setInputValue(String(value))
    setEditing(true)
  }

  const commitEdit = () => {
    const parsed = Number(inputValue)
    if (Number.isFinite(parsed)) setValue(parsed)
    setEditing(false)
  }

  const resetToDefault = () => {
    if (defaultValue !== undefined) setValue(defaultValue)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const fine = e.altKey || e.ctrlKey
    const delta = fine ? step / 10 : step
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      setValue(value + delta)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setValue(value - delta)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openEditor()
    }
  }

  const angle = ANGLE_START + ((value - min) / (max - min)) * ANGLE_RANGE
  const decimals = step < 1 ? 1 : 0
  const display = formatValue ? formatValue(value) : value.toFixed(decimals)

  return (
    <div className={cn('ui-knob', className)} style={{ '--knob-color': color } as CSSProperties}>
      {label && <span className="ui-knob__label">{label}</span>}
      <div
        className="ui-knob__face"
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${display}${unit}`}
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onDoubleClick={resetToDefault}
      >
        <svg className="ui-knob__track" viewBox="0 0 58 58" aria-hidden>
          <path
            className="ui-knob__track-bg"
            d={describeArc(29, 29, 26, ANGLE_START, ANGLE_START + ANGLE_RANGE)}
          />
          <path className="ui-knob__track-fill" d={describeArc(29, 29, 26, ANGLE_START, angle)} />
        </svg>
        <div className="ui-knob__face-inner" />
        <div className="ui-knob__pointer" style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <input
        className="ui-knob__slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      {editing ? (
        <input
          className="ui-knob__input"
          autoFocus
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <button type="button" className="ui-knob__value" onDoubleClick={openEditor}>
          {display}
          {unit}
        </button>
      )}
    </div>
  )
}
