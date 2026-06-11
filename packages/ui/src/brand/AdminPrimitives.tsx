// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'

/* ── KpiCard ───────────────────────────────────────────────────────── */

export type KpiColor = 'cyan' | 'amber' | 'green' | 'purple' | 'coral' | 'neutral'

export interface KpiCardProps {
  color: KpiColor
  value: React.ReactNode
  label: string
  className?: string
}

/** Small KPI tile — value in a bound color, uppercase label below. Always used inside <KpiCardRow>. */
export function KpiCard({ color, value, label, className }: KpiCardProps) {
  return (
    <div
      className={cn('kpi-card', `kpi-card--${color}`, className)}
      role="group"
      aria-label={label}
    >
      <div className="kpi-card__value">{value}</div>
      <div className="kpi-card__label">{label}</div>
    </div>
  )
}

export interface KpiCardRowProps {
  children: React.ReactNode
  className?: string
  'aria-label'?: string
}

/** 4-column KPI grid (2x2 on mobile). */
export function KpiCardRow({ children, className, 'aria-label': ariaLabel }: KpiCardRowProps) {
  return (
    <div className={cn('kpi-card-row', className)} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  )
}

/* ── StatusPill ────────────────────────────────────────────────────── */

export type StatusPillTone = 'green' | 'amber' | 'purple' | 'coral' | 'cyan'

export interface StatusPillProps {
  tone: StatusPillTone
  children: React.ReactNode
  className?: string
}

/** Small uppercase status pill — tone encodes meaning (green=ok/paid, amber=pending, coral=danger…). */
export function StatusPill({ tone, children, className }: StatusPillProps) {
  return <span className={cn('status-pill', `status-pill--${tone}`, className)}>{children}</span>
}

/* ── DataRowList ───────────────────────────────────────────────────── */

export interface DataRowListProps {
  children: React.ReactNode
  className?: string
}

/** Bordered, rounded container for header + rows. */
export function DataRowList({ children, className }: DataRowListProps) {
  return <div className={cn('data-row-list', className)}>{children}</div>
}

export interface DataRowListHeaderProps {
  children: React.ReactNode
  /** Inline grid-template-columns for this view's column layout. */
  columns?: string
  className?: string
}

export function DataRowListHeader({ children, columns, className }: DataRowListHeaderProps) {
  return (
    <div
      className={cn('data-row-list__header', className)}
      style={columns ? { gridTemplateColumns: columns } : undefined}
    >
      {children}
    </div>
  )
}

export interface DataRowListRowProps {
  children: React.ReactNode
  columns?: string
  className?: string
}

export function DataRowListRow({ children, columns, className }: DataRowListRowProps) {
  return (
    <div
      className={cn('data-row-list__row', className)}
      style={columns ? { gridTemplateColumns: columns } : undefined}
    >
      {children}
    </div>
  )
}

export interface DataRowListEmptyProps {
  children: React.ReactNode
  className?: string
}

export function DataRowListEmpty({ children, className }: DataRowListEmptyProps) {
  return <div className={cn('data-row-list__empty', className)}>{children}</div>
}

/* ── Money cell ────────────────────────────────────────────────────── */

export interface MoneyCellProps {
  /** Positive => green, negative => coral, zero/neutral => default text color. */
  value: number
  children: React.ReactNode
  className?: string
}

/** Mono, right-aligned money figure — green for positive, coral for negative. */
export function MoneyCell({ value, children, className }: MoneyCellProps) {
  return (
    <span
      className={cn(
        'money-cell',
        value > 0 && 'money-cell--positive',
        value < 0 && 'money-cell--negative',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ── AdminMiniSidebar ──────────────────────────────────────────────── */

export interface AdminMiniSidebarItem {
  href: string
  label: string
}

export interface AdminMiniSidebarGroup {
  label: string
  items: AdminMiniSidebarItem[]
}

export interface AdminMiniSidebarProps {
  groups: AdminMiniSidebarGroup[]
  activeHref: string
  className?: string
}

/** 118px-wide grouped admin nav rail. */
export function AdminMiniSidebar({ groups, activeHref, className }: AdminMiniSidebarProps) {
  return (
    <nav className={cn('admin-mini-sidebar', className)} aria-label="Admin sections">
      {groups.map((group) => (
        <div key={group.label} className="admin-mini-sidebar__group">
          <div className="admin-mini-sidebar__group-label">{group.label}</div>
          {group.items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'admin-mini-sidebar__item',
                item.href === activeHref && 'admin-mini-sidebar__item--active',
              )}
              aria-current={item.href === activeHref ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  )
}

/* ── AdminContextStrip ─────────────────────────────────────────────── */

export interface AdminContextStripProps {
  handle: string
  className?: string
}

/** Amber strip reminding board members that admin actions are audit-logged. */
export function AdminContextStrip({ handle, className }: AdminContextStripProps) {
  return (
    <div className={cn('admin-context-strip', className)} role="note">
      ⚠ ADMIN VIEW · acting as board member @{handle} · all actions audit-logged
    </div>
  )
}

/* ── MoneyBreakdown ────────────────────────────────────────────────── */

export interface MoneyBreakdownLine {
  label: string
  /** Pre-formatted amount string, e.g. "€5.00" or "−€0.45". */
  amount: string
  /** 'green' | 'amber' | 'cyan' tints the amount; omit for default text color. */
  tone?: 'green' | 'amber' | 'cyan'
  /** Render as the emphasized final total row (top border + bold). */
  total?: boolean
}

export interface MoneyBreakdownProps {
  lines: MoneyBreakdownLine[]
  className?: string
}

/** "Where €X goes" breakdown card — rows of label … mono amount. */
export function MoneyBreakdown({ lines, className }: MoneyBreakdownProps) {
  return (
    <div className={cn('money-breakdown', className)}>
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            'money-breakdown__row',
            line.total && 'money-breakdown__row--total',
            line.tone && `money-breakdown__row--${line.tone}`,
          )}
        >
          <span className="money-breakdown__label">{line.label}</span>
          <span className="money-breakdown__amount">{line.amount}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Progress bar ──────────────────────────────────────────────────── */

export interface ProgressBarProps {
  label: string
  amount: string
  /** 0-100 */
  percent: number
  color: 'green' | 'cyan'
  className?: string
}

/** Labeled 6px progress bar with a right-aligned amount (e.g. "where surplus goes"). */
export function ProgressBar({ label, amount, percent, color, className }: ProgressBarProps) {
  return (
    <div className={cn('progress-bar', className)}>
      <div className="progress-bar__head">
        <span className="progress-bar__label">{label}</span>
        <span className="progress-bar__amount">{amount}</span>
      </div>
      <div className="progress-bar__track">
        <div
          className={cn('progress-bar__fill', `progress-bar__fill--${color}`)}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  )
}
