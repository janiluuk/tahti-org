// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export function SocialField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="studio-social-field">
      <span className="studio-label">{label}</span>
      {children}
      {hint ? <p className="studio-social-field__hint">{hint}</p> : null}
    </div>
  )
}

export function SocialInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="studio-input" {...props} />
}

export function SocialTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="studio-input" rows={2} {...props} />
}

export function SocialToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="studio-social-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function SocialOptions({ children }: { children: ReactNode }) {
  return <div className="studio-social-options">{children}</div>
}

export function SocialActions({ children }: { children: ReactNode }) {
  return <div className="studio-social-actions">{children}</div>
}
