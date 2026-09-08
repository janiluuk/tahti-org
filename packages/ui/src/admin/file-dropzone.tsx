'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import {
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from '../lib/cn'

export type FileDropzoneProps = {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  /** Visible label when `children` is omitted; always used as the accessible name. */
  label: string
  hint?: string
  selectedText?: string
  className?: string
  style?: CSSProperties
  /**
   * When true, skip the default `.studio-file-dropzone` chrome so callers can
   * supply a specialized surface (avatar/logo pickers) via `className` + `children`.
   */
  bare?: boolean
  /** Custom drop-surface content (preview image, initials, etc.). */
  children?: ReactNode
  /**
   * Optional DataTransfer resolver (e.g. recurse into dropped folders).
   * Defaults to `Array.from(dataTransfer.files)`.
   */
  resolveDroppedFiles?: (dataTransfer: DataTransfer) => File[] | Promise<File[]>
  onFiles: (files: File[]) => void
}

export function FileDropzone({
  accept,
  multiple = false,
  disabled = false,
  label,
  hint,
  selectedText,
  className,
  style,
  bare = false,
  children,
  resolveDroppedFiles,
  onFiles,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function commit(files: File[]) {
    if (disabled || files.length === 0) return
    onFiles(multiple ? files : files.slice(0, 1))
    if (inputRef.current) inputRef.current.value = ''
  }

  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = resolveDroppedFiles
      ? await resolveDroppedFiles(event.dataTransfer)
      : Array.from(event.dataTransfer.files)
    commit(files)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    inputRef.current?.click()
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={label}
      style={style}
      className={cn(!bare && 'studio-file-dropzone', dragging && 'is-dragging', className)}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={onKeyDown}
      onDragEnter={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => void onDrop(event)}
    >
      {children ?? (
        <>
          <strong>{label}</strong>
          {selectedText ? <span>{selectedText}</span> : hint ? <span>{hint}</span> : null}
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="studio-hidden-input"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => commit(Array.from(event.target.files ?? []))}
      />
    </div>
  )
}
