'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { cn } from '../lib/cn'

export type FileDropzoneProps = {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  label: string
  hint?: string
  selectedText?: string
  className?: string
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
  onFiles,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function commit(files: File[]) {
    if (disabled || files.length === 0) return
    onFiles(multiple ? files : files.slice(0, 1))
    if (inputRef.current) inputRef.current.value = ''
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    commit(Array.from(event.dataTransfer.files))
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
      className={cn('studio-file-dropzone', dragging && 'is-dragging', className)}
      onClick={() => inputRef.current?.click()}
      onKeyDown={onKeyDown}
      onDragEnter={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <strong>{label}</strong>
      {selectedText ? <span>{selectedText}</span> : hint ? <span>{hint}</span> : null}
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
