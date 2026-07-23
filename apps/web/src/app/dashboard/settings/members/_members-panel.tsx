'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { Panel, Button, ButtonIcon, SortableList, type SortableItemHandle } from '@tahti/ui'
import type { ChannelMemberView } from '@tahti/shared'
import { CoverImageUpload } from '@/components/cover-image-upload'
import {
  completeMemberPicture,
  createMember,
  deleteMember,
  memberPictureFromUrl,
  prepareMemberPicture,
  reorderMembers,
  updateMember,
} from './actions'

function MemberRow({
  member,
  sortable,
  onChanged,
  onRemoved,
}: {
  member: ChannelMemberView
  sortable: SortableItemHandle
  onChanged: (id: string, patch: Partial<ChannelMemberView>) => void
  onRemoved: (id: string) => void
}) {
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState(member.role)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveField(field: 'name' | 'role', value: string) {
    setPending(true)
    setError(null)
    const res = await updateMember(member.id, { [field]: value })
    if (res.error) setError(res.error)
    else onChanged(member.id, { [field]: value })
    setPending(false)
  }

  async function remove() {
    setPending(true)
    const res = await deleteMember(member.id)
    if (res.error) {
      setError(res.error)
      setPending(false)
      return
    }
    onRemoved(member.id)
  }

  return (
    <div ref={sortable.ref} className="member-row">
      <button
        type="button"
        ref={sortable.handleRef}
        className="member-row__handle"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <div className="member-row__picture">
        <CoverImageUpload
          currentUrl={member.pictureUrl}
          label=""
          onUploaded={(url) => onChanged(member.id, { pictureUrl: url })}
          prepare={({ filename, contentType }) =>
            prepareMemberPicture(member.id, filename, contentType)
          }
          complete={(uploadKey) => completeMemberPicture(member.id, uploadKey)}
          fromUrl={(sourceUrl) => memberPictureFromUrl(member.id, sourceUrl)}
        />
      </div>
      <div className="member-row__fields">
        <input
          type="text"
          className="studio-input"
          value={name}
          disabled={pending}
          placeholder="Name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== member.name && saveField('name', name.trim())}
        />
        <input
          type="text"
          className="studio-input"
          value={role}
          disabled={pending}
          placeholder="Role (e.g. Vocals, Producer, Mixing House)"
          onChange={(e) => setRole(e.target.value)}
          onBlur={() => role.trim() && role !== member.role && saveField('role', role.trim())}
        />
      </div>
      <Button onClick={remove} variant="ghost" size="sm" className="studio-text-error">
        Remove
      </Button>
      {error && <p className="studio-notice studio-notice--error member-row__error">{error}</p>}
    </div>
  )
}

export function MembersPanel({ initialMembers }: { initialMembers: ChannelMemberView[] }) {
  const [members, setMembers] = useState(initialMembers)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!name.trim() || !role.trim()) {
      setError('Name and role are both required.')
      return
    }
    setPending(true)
    setError(null)
    const res = await createMember(name.trim(), role.trim())
    if (res.error || !res.member) {
      setError(res.error ?? 'Failed to add member')
      setPending(false)
      return
    }
    setMembers((prev) => [...prev, res.member!])
    setName('')
    setRole('')
    setPending(false)
  }

  function onChanged(id: string, patch: Partial<ChannelMemberView>) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function onRemoved(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  async function handleReorder(next: ChannelMemberView[]) {
    setMembers(next)
    await reorderMembers(next.map((m) => m.id))
  }

  return (
    <Panel
      title="Members & credits"
      headerTight
      description="Show your lineup and give credit to producers, mixing engineers, or anyone else who worked on your music."
    >
      {members.length === 0 ? (
        <p className="studio-text-muted-sm studio-mb-md">Nothing added yet — add one below.</p>
      ) : (
        <SortableList
          items={members}
          itemId={(m) => m.id}
          onReorder={handleReorder}
          className="member-list"
          renderItem={(m, _idx, sortable) => (
            <MemberRow
              key={m.id}
              member={m}
              sortable={sortable}
              onChanged={onChanged}
              onRemoved={onRemoved}
            />
          )}
        />
      )}

      <div className="member-add-row">
        <input
          type="text"
          className="studio-input"
          value={name}
          disabled={pending}
          placeholder="Name"
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          className="studio-input"
          value={role}
          disabled={pending}
          placeholder="Role (e.g. Vocals, Producer, Mixing House)"
          onChange={(e) => setRole(e.target.value)}
        />
        <Button onClick={add} disabled={pending} variant="primary">
          <ButtonIcon name="plus" />
          Add
        </Button>
      </div>
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </Panel>
  )
}
