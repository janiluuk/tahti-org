// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Alert, Button, Field, Heading, Input } from '@tahti/ui'

interface Meeting {
  id: string
  title: string
  type: string
  state: string
  scheduledAt: string | null
}

interface DocumentItem {
  id: string
  title: string
  type: string
  version: number
  publishedAt: string | null
  downloadUrl: string | null
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
  const [meetingTitle, setMeetingTitle] = useState('')
  const [documentTitle, setDocumentTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function createMeeting() {
    setError(null)
    const response = await fetch('/api/admin/governance/meetings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: meetingTitle, type: 'GENERAL' }),
    })
    if (!response.ok) return setError('Could not create meeting')
    const meeting = (await response.json()) as Meeting
    setMeetings((items) => [meeting, ...items])
    setMeetingTitle('')
  }

  async function createDocument() {
    setError(null)
    const response = await fetch('/api/admin/governance/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: documentTitle, type: 'OTHER' }),
    })
    if (!response.ok) return setError('Could not create document record')
    const document = (await response.json()) as DocumentItem
    setDocuments((items) => [document, ...items])
    setDocumentTitle('')
  }

  return (
    <section className="admin-card admin-governance-records">
      <div className="admin-governance-records__header">
        <div>
          <Heading level={2}>Governance records</Heading>
          <p className="admin-stat-sub">
            Persist meeting shells and maintain the official document index.
          </p>
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="admin-governance-records__forms">
        <div>
          <Field label="New meeting">
            <Input
              value={meetingTitle}
              onChange={(event) => setMeetingTitle(event.target.value)}
              placeholder="e.g. 2026 annual general meeting"
            />
          </Field>
          <Button
            variant="secondary"
            size="sm"
            onClick={createMeeting}
            disabled={!meetingTitle.trim()}
          >
            Save meeting
          </Button>
        </div>
        <div>
          <Field label="New document record">
            <Input
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
              placeholder="e.g. Current bylaws"
            />
          </Field>
          <Button
            variant="secondary"
            size="sm"
            onClick={createDocument}
            disabled={!documentTitle.trim()}
          >
            Save document record
          </Button>
        </div>
      </div>
      <div className="admin-governance-records__lists">
        <div>
          <h3>Meetings</h3>
          {meetings.length === 0 ? (
            <p className="admin-stat-sub">No meetings recorded.</p>
          ) : (
            meetings.map((meeting) => (
              <p key={meeting.id}>
                <strong>{meeting.title}</strong> · {meeting.state}
              </p>
            ))
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
                {document.downloadUrl && (
                  <>
                    {' '}
                    · <a href={document.downloadUrl}>Download</a>
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
