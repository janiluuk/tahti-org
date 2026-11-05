// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { DISPLAY_NAME_EMAIL_MESSAGE, containsEmailAddress } from '../display-name.js'

export const ARTIST_GROUP_JOIN_POLICIES = ['OPEN', 'REQUEST'] as const
export const ARTIST_GROUP_SUBMIT_POLICIES = ['OPEN', 'APPROVE'] as const
export const ARTIST_GROUP_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const

const groupText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !containsEmailAddress(v), { message: DISPLAY_NAME_EMAIL_MESSAGE })

export const CreateArtistGroupSchema = z.object({
  name: groupText(100).pipe(z.string().min(1, 'name is required')),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,47}$/, 'slug must be 2-48 characters: a-z, 0-9 and dashes')
    .optional(),
  description: groupText(1000).optional(),
  coverUrl: z.string().trim().url().max(500).optional(),
  isPublic: z.boolean().optional(),
  joinPolicy: z.enum(ARTIST_GROUP_JOIN_POLICIES).optional(),
  submitPolicy: z.enum(ARTIST_GROUP_SUBMIT_POLICIES).optional(),
})

export type CreateArtistGroupInput = z.infer<typeof CreateArtistGroupSchema>

export const PatchArtistGroupSchema = z
  .object({
    name: groupText(100).pipe(z.string().min(1, 'name is required')).optional(),
    description: groupText(1000).nullable().optional(),
    coverUrl: z.string().trim().url().max(500).nullable().optional(),
    isPublic: z.boolean().optional(),
    joinPolicy: z.enum(ARTIST_GROUP_JOIN_POLICIES).optional(),
    submitPolicy: z.enum(ARTIST_GROUP_SUBMIT_POLICIES).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' })

export type PatchArtistGroupInput = z.infer<typeof PatchArtistGroupSchema>

export const ResolveJoinRequestSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
})

export type ResolveJoinRequestInput = z.infer<typeof ResolveJoinRequestSchema>

export const SubmitGroupSoundSchema = z.object({
  soundId: z.string().min(1),
  note: z.string().trim().max(200).optional(),
})

export type SubmitGroupSoundInput = z.infer<typeof SubmitGroupSoundSchema>

export const GroupRequestParamsSchema = z.object({
  slug: z.string().min(1).max(64),
  requestId: z.string().min(1).max(64),
})

export const GroupSubmissionParamsSchema = z.object({
  slug: z.string().min(1).max(64),
  submissionId: z.string().min(1).max(64),
})

export const PublicGroupListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

/** Shared shape of a group in lists and details. */
export const ArtistGroupSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  isPublic: z.boolean(),
  joinPolicy: z.enum(ARTIST_GROUP_JOIN_POLICIES),
  submitPolicy: z.enum(ARTIST_GROUP_SUBMIT_POLICIES),
  collectionSlug: z.string(),
  memberCount: z.number().int(),
  itemCount: z.number().int(),
})

export type ArtistGroupSummary = z.infer<typeof ArtistGroupSummarySchema>

export const MyArtistGroupSchema = ArtistGroupSummarySchema.extend({
  role: z.enum(ARTIST_GROUP_ROLES),
  pendingJoinRequestCount: z.number().int(),
  pendingSubmissionCount: z.number().int(),
})

export type MyArtistGroup = z.infer<typeof MyArtistGroupSchema>

/** One of the caller's groups, and whether the sound is already in its playlist. */
export const GroupMembershipEntrySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  coverUrl: z.string().nullable(),
  isPublic: z.boolean(),
  submitPolicy: z.enum(ARTIST_GROUP_SUBMIT_POLICIES),
  role: z.enum(ARTIST_GROUP_ROLES),
  /** Collective playlist slug (`group-<groupSlug>`). */
  collectionSlug: z.string(),
  itemCount: z.number().int(),
  member: z.boolean(),
  itemId: z.string().nullable(),
  submissionPending: z.boolean(),
})

export const GroupSoundSubmissionSchema = z.object({
  id: z.string(),
  note: z.string().nullable(),
  createdAt: z.coerce.date().or(z.string()),
  sound: z.object({ id: z.string(), title: z.string() }),
  submittedBy: z.object({ username: z.string(), displayName: z.string() }),
})

export type GroupSoundSubmission = z.infer<typeof GroupSoundSubmissionSchema>

export const PublicArtistGroupDetailSchema = ArtistGroupSummarySchema.extend({
  createdBy: z.object({ username: z.string(), displayName: z.string() }),
  members: z.array(
    z.object({
      username: z.string(),
      displayName: z.string(),
      role: z.enum(ARTIST_GROUP_ROLES),
    }),
  ),
  viewer: z.object({
    role: z.enum(ARTIST_GROUP_ROLES).nullable(),
    joinRequestPending: z.boolean(),
  }),
})

export type PublicArtistGroupDetail = z.infer<typeof PublicArtistGroupDetailSchema>

export const GroupMembershipResponseSchema = z.array(GroupMembershipEntrySchema)

export type GroupMembershipEntry = z.infer<typeof GroupMembershipEntrySchema>

export const GroupMemberParamsSchema = z.object({
  slug: z.string().min(1).max(64),
  username: z.string().min(1).max(64),
})

/** One member of a group, as other members see them. */
export const GroupMemberSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  role: z.enum(ARTIST_GROUP_ROLES),
  joinedAt: z.coerce.date().or(z.string()),
})

export type GroupMember = z.infer<typeof GroupMemberSchema>

export const GroupMemberListSchema = z.object({
  items: z.array(GroupMemberSchema),
  total: z.number().int(),
})

/** Owner only: make a member an admin or an admin a member again. */
export const PatchGroupMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
})

/** Owner only: hand the group, and its playlist, to another member. */
export const TransferArtistGroupSchema = z.object({
  username: z.string().trim().min(1).max(64),
})
