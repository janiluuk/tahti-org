// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export interface ConversationParticipant {
  username: string
  displayName: string
  avatarUrl: string | null
  channelRole?: 'owner' | 'moderator' | null
}

export interface MessageView {
  id: string
  senderUsername: string
  senderDisplayName: string
  senderAvatarUrl: string | null
  body: string
  createdAt: string
  isMine: boolean
  senderChannelRole?: 'owner' | 'moderator' | null
}

export interface ConversationSummary {
  id: string
  otherUser: ConversationParticipant
  lastMessage: { body: string; senderUsername: string; createdAt: string } | null
  unreadCount: number
  updatedAt: string
}

export interface ConversationDetail {
  id: string
  otherUser: ConversationParticipant
  messages: MessageView[]
}

export interface MessageContact extends ConversationParticipant {
  followsYou: boolean
  followedByYou: boolean
}

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const res = await fetch(`${apiUrl}/api/me/messages/conversations`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return (await res.json()) as ConversationSummary[]
}

export async function fetchMessageContacts(): Promise<MessageContact[]> {
  const res = await fetch(`${apiUrl}/api/me/messages/contacts`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return (await res.json()) as MessageContact[]
}

export async function fetchConversation(id: string): Promise<ConversationDetail | null> {
  const res = await fetch(`${apiUrl}/api/me/messages/conversations/${id}`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as ConversationDetail
}

export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<{ error: string | null; message?: MessageView }> {
  const res = await fetch(`${apiUrl}/api/me/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ body }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { error: (data as { error?: string }).error ?? 'Failed to send message' }
  revalidatePath('/dashboard/messages')
  return { error: null, message: data as MessageView }
}

export async function startConversation(
  username: string,
): Promise<{ error: string | null; unauthorized?: boolean; conversationId?: string }> {
  const res = await fetch(`${apiUrl}/api/me/messages/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ username }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      error: (data as { error?: string }).error ?? 'Failed to start conversation',
      unauthorized: res.status === 401,
    }
  }
  return { error: null, conversationId: (data as { conversationId: string }).conversationId }
}

export async function searchUsers(
  q: string,
): Promise<Array<{ username: string; displayName: string; avatarUrl: string | null }>> {
  if (q.trim().length < 2) return []
  const res = await fetch(`${apiUrl}/api/users/search?q=${encodeURIComponent(q)}`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return (await res.json()) as Array<{
    username: string
    displayName: string
    avatarUrl: string | null
  }>
}
