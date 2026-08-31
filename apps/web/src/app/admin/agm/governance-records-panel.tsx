// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Fragment, type FormEvent, useState } from 'react'

interface AgendaItem {
  title: string
  description?: string
}

interface Meeting {
  id: string
  title: string
  type: string
  state: string
  scheduledAt: string | null
  location: string | null
  remoteUrl: string | null
  noticeAt: string | null
  agenda: AgendaItem[] | null
  eligibleMemberCount: number | null
  quorumRequired: number | null
  attendanceCount: number
  presentCount: number
  quorumMet: boolean | null
}

interface DocumentItem {
  id: string
  title: string
  type: string
  description: string | null
  version: number
  effectiveAt: string | null
  publishedAt: string | null
  meetingId: string | null
  downloadUrl: string | null
  externalUrl: string | null
}

interface AttendanceRecord {
  id: string
  memberId: string | null
  displayName: string
  status: string
  recordedAt: string
}

const MEETING_TYPES = [
  { value: 'GENERAL', label: 'AGM (general meeting)' },
  { value: 'EXTRAORDINARY_GENERAL', label: 'Extraordinary general meeting' },
  { value: 'BOARD', label: 'Board meeting' },
]

const MEETING_STATES = ['DRAFT', 'SCHEDULED', 'HELD', 'MINUTES_DRAFT', 'APPROVED', 'CANCELLED']

const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'EXCUSED']

const DOCUMENT_TYPES = [
  { value: 'BYLAWS', label: 'Bylaws' },
  { value: 'POLICY', label: 'Policy' },
  { value: 'MEETING_NOTICE', label: 'Meeting notice' },
  { value: 'MINUTES', label: 'Minutes' },
  { value: 'ANNUAL_REPORT', label: 'Annual report' },
  { value: 'FINANCIAL_STATEMENT', label: 'Financial statement' },
  { value: 'AUDIT_REPORT', label: 'Audit report' },
  { value: 'OTHER', label: 'Other' },
]

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

function fieldString(fd: FormData, name: string): string {
  return String(fd.get(name) ?? '').trim()
}

function localDateTimeToIso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

export function GovernanceRecordsPanel({
  initialMeetings,
  initialDocuments,
}: {
  initialMeetings: Meeting[]
  initialDocuments: DocumentItem[]
}) {
  const [meetings, setMeetings] = useState(initialMeetings)
  const [documents, setDocuments] = useState(initialDocuments)
  const [error, setError] = useState<string | null>(null)
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null)
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord[]>>({})

  async function createMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget
    const fd = new FormData(form)
    const agenda = fieldString(fd, 'agenda')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title): AgendaItem => ({ title }))
    const eligibleMemberCount = fieldString(fd, 'eligibleMemberCount')
    const quorumRequired = fieldString(fd, 'quorumRequired')

    const response = await fetch(`${API_BASE}/api/admin/governance/meetings`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: fieldString(fd, 'title'),
        type: fieldString(fd, 'type'),
        scheduledAt: localDateTimeToIso(fieldString(fd, 'scheduledAt')),
        location: fieldString(fd, 'location') || undefined,
        remoteUrl: fieldString(fd, 'remoteUrl') || undefined,
        noticeAt: localDateTimeToIso(fieldString(fd, 'noticeAt')),
        eligibleMemberCount: eligibleMemberCount ? Number(eligibleMemberCount) : undefined,
        quorumRequired: quorumRequired ? Number(quorumRequired) : undefined,
        agenda: agenda.length > 0 ? agenda : undefined,
      }),
    })
    if (!response.ok) return setError('Could not create meeting')
    const meeting = (await response.json()) as Meeting
    setMeetings((items) => [meeting, ...items])
    form.reset()
  }

  async function updateMeetingState(id: string, state: string) {
    setError(null)
    const response = await fetch(`${API_BASE}/api/admin/governance/meetings/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state }),
    })
    if (!response.ok) return setError('Could not update meeting state')
    const updated = (await response.json()) as Meeting
    setMeetings((items) => items.map((m) => (m.id === id ? updated : m)))
  }

  async function loadAttendance(meetingId: string) {
    if (attendance[meetingId]) return
    const response = await fetch(
      `${API_BASE}/api/admin/governance/meetings/${meetingId}/attendance`,
      { credentials: 'include' },
    )
    if (!response.ok) return
    const records = (await response.json()) as AttendanceRecord[]
    setAttendance((prev) => ({ ...prev, [meetingId]: records }))
  }

  async function toggleExpand(meetingId: string) {
    const next = expandedMeetingId === meetingId ? null : meetingId
    setExpandedMeetingId(next)
    if (next) await loadAttendance(next)
  }

  async function addAttendance(meetingId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget
    const fd = new FormData(form)
    const displayName = fieldString(fd, 'displayName')
    if (!displayName) return
    const status = fieldString(fd, 'status')

    const response = await fetch(
      `${API_BASE}/api/admin/governance/meetings/${meetingId}/attendance`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName, status }),
      },
    )
    if (!response.ok) return setError('Could not record attendance')
    const record = (await response.json()) as AttendanceRecord
    const nextRecords = [
      ...(attendance[meetingId] ?? []).filter((a) => a.displayName !== displayName),
      record,
    ]
    setAttendance((prev) => ({ ...prev, [meetingId]: nextRecords }))
    const presentCount = nextRecords.filter((a) => a.status === 'PRESENT').length
    setMeetings((items) =>
      items.map((m) =>
        m.id === meetingId
          ? {
              ...m,
              attendanceCount: nextRecords.length,
              presentCount,
              quorumMet: m.quorumRequired == null ? null : presentCount >= m.quorumRequired,
            }
          : m,
      ),
    )
    form.reset()
  }

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget
    const fd = new FormData(form)
    const publishNow = fd.get('publishNow') === 'on'

    const response = await fetch(`${API_BASE}/api/admin/governance/documents`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: fieldString(fd, 'title'),
        type: fieldString(fd, 'type'),
        description: fieldString(fd, 'description') || undefined,
        externalUrl: fieldString(fd, 'externalUrl') || undefined,
        effectiveAt: localDateTimeToIso(fieldString(fd, 'effectiveAt')),
        meetingId: fieldString(fd, 'meetingId') || undefined,
        publishedAt: publishNow ? new Date().toISOString() : undefined,
      }),
    })
    if (!response.ok) return setError('Could not create document record')
    const document = (await response.json()) as DocumentItem
    setDocuments((items) => [document, ...items])
    form.reset()
  }

  return (
    <section className="admin-governance-records">
      <div className="admin-governance-records__header">
        <h2>Governance records</h2>
        <p className="admin-stat-sub">
          Persist official AGM/board meetings — agenda, notice, attendance, and quorum — and the
          document index that backs them.
        </p>
      </div>
      {error && <p className="admin-err">{error}</p>}

      <details className="admin-card studio-details-block" style={{ marginBottom: '1rem' }}>
        <summary>New meeting</summary>
        <form onSubmit={createMeeting} style={{ marginTop: '0.75rem' }}>
          <div className="admin-governance-records__grid">
            <label>
              Title
              <input
                name="title"
                required
                maxLength={200}
                placeholder="2026 annual general meeting"
              />
            </label>
            <label>
              Type
              <select name="type" defaultValue="GENERAL">
                {MEETING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Scheduled at
              <input name="scheduledAt" type="datetime-local" />
            </label>
            <label>
              Notice sent at
              <input name="noticeAt" type="datetime-local" />
            </label>
            <label>
              Location
              <input name="location" maxLength={300} placeholder="Physical venue, if any" />
            </label>
            <label>
              Remote URL
              <input name="remoteUrl" type="url" placeholder="https://…" />
            </label>
            <label>
              Eligible member count
              <input name="eligibleMemberCount" type="number" min={0} />
            </label>
            <label>
              Quorum required
              <input name="quorumRequired" type="number" min={1} />
            </label>
          </div>
          <label style={{ marginTop: '0.65rem', display: 'block' }}>
            Agenda (one item per line)
            <textarea
              name="agenda"
              rows={4}
              placeholder={'Call to order\nQuorum check\nBoard report\n…'}
            />
          </label>
          <button type="submit" className="admin-btn" style={{ marginTop: '0.65rem' }}>
            Save meeting
          </button>
        </form>
      </details>

      <details className="admin-card studio-details-block" style={{ marginBottom: '1rem' }}>
        <summary>New document record</summary>
        <form onSubmit={createDocument} style={{ marginTop: '0.75rem' }}>
          <div className="admin-governance-records__grid">
            <label>
              Title
              <input name="title" required maxLength={200} placeholder="Current bylaws" />
            </label>
            <label>
              Type
              <select name="type" defaultValue="OTHER">
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Effective at
              <input name="effectiveAt" type="datetime-local" />
            </label>
            <label>
              External URL
              <input
                name="externalUrl"
                type="url"
                placeholder="https://… (or leave blank for an upload)"
              />
            </label>
            <label>
              Linked meeting
              <select name="meetingId" defaultValue="">
                <option value="">— none —</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label style={{ marginTop: '0.65rem', display: 'block' }}>
            Description
            <textarea name="description" rows={2} />
          </label>
          <label
            style={{
              marginTop: '0.65rem',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <input name="publishNow" type="checkbox" style={{ width: 'auto' }} />
            Publish immediately (visible to members)
          </label>
          <button type="submit" className="admin-btn" style={{ marginTop: '0.65rem' }}>
            Save document record
          </button>
        </form>
      </details>

      <div className="admin-governance-records__lists">
        <div>
          <h3>Meetings</h3>
          {meetings.length === 0 ? (
            <p className="admin-stat-sub">No meetings recorded.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-governance-records__meetings-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>State</th>
                    <th>Scheduled</th>
                    <th>Quorum</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((meeting) => (
                    <Fragment key={meeting.id}>
                      <tr>
                        <td>
                          <strong>{meeting.title}</strong>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                          {MEETING_TYPES.find((t) => t.value === meeting.type)?.label ??
                            meeting.type}
                        </td>
                        <td>
                          <select
                            value={meeting.state}
                            onChange={(e) => updateMeetingState(meeting.id, e.target.value)}
                            style={{ width: '6.5rem', maxWidth: '100%', fontSize: '0.75rem' }}
                          >
                            {MEETING_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s.replaceAll('_', ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          {meeting.scheduledAt
                            ? new Date(meeting.scheduledAt).toLocaleString('fi-FI')
                            : '—'}
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          {meeting.quorumRequired == null
                            ? '—'
                            : `${meeting.presentCount}/${meeting.quorumRequired}${meeting.quorumMet ? ' ✓' : ''}`}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn admin-btn--icon"
                            onClick={() => toggleExpand(meeting.id)}
                          >
                            {expandedMeetingId === meeting.id ? '▲' : '▼'}
                          </button>
                        </td>
                      </tr>
                      {expandedMeetingId === meeting.id && (
                        <tr>
                          <td colSpan={6}>
                            <div className="admin-governance-records__attendance">
                              {meeting.agenda && meeting.agenda.length > 0 && (
                                <div>
                                  <p className="admin-stat-sub" style={{ marginBottom: '0.35rem' }}>
                                    Agenda
                                  </p>
                                  <ol
                                    style={{
                                      margin: 0,
                                      paddingLeft: '1.25rem',
                                      fontSize: '0.8125rem',
                                    }}
                                  >
                                    {meeting.agenda.map((item, i) => (
                                      <li key={i}>{item.title}</li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                              <div>
                                <p className="admin-stat-sub" style={{ marginBottom: '0.35rem' }}>
                                  Attendance ({attendance[meeting.id]?.length ?? 0})
                                </p>
                                {(attendance[meeting.id] ?? []).map((record) => (
                                  <p
                                    key={record.id}
                                    style={{ fontSize: '0.8125rem', margin: '0.2rem 0' }}
                                  >
                                    {record.displayName} · {record.status.toLowerCase()}
                                  </p>
                                ))}
                                <form
                                  onSubmit={(e) => addAttendance(meeting.id, e)}
                                  style={{
                                    display: 'flex',
                                    gap: '0.5rem',
                                    marginTop: '0.5rem',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <input
                                    name="displayName"
                                    placeholder="Member name"
                                    required
                                    className="admin-input"
                                    style={{ maxWidth: '12rem' }}
                                  />
                                  <select
                                    name="status"
                                    defaultValue="PRESENT"
                                    className="admin-input"
                                    style={{ maxWidth: '8rem' }}
                                  >
                                    {ATTENDANCE_STATUSES.map((s) => (
                                      <option key={s} value={s}>
                                        {s.toLowerCase()}
                                      </option>
                                    ))}
                                  </select>
                                  <button type="submit" className="admin-btn admin-btn--icon">
                                    Add
                                  </button>
                                </form>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <h3>Documents</h3>
          {documents.length === 0 ? (
            <p className="admin-stat-sub">No documents indexed.</p>
          ) : (
            documents.map((document) => (
              <p key={document.id}>
                <strong>{document.title}</strong> · v{document.version}
                {document.publishedAt ? ' · published' : ' · draft'}
                {(document.downloadUrl || document.externalUrl) && (
                  <>
                    {' '}
                    · <a href={document.downloadUrl ?? document.externalUrl ?? '#'}>Open</a>
                  </>
                )}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
