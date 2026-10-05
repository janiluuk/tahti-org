// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const SupportCategorySchema = z.enum([
  'ENGAGEMENT_DISPUTE',
  'TECHNICAL',
  'FINANCIAL',
  'OTHER',
])

export const SupportStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED'])

export const SupportContactSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  category: SupportCategorySchema.default('OTHER'),
  contactEmail: z.string().email().optional(),
})

export const SupportContactResponseSchema = z.object({
  ok: z.literal(true),
  ticketId: z.string(),
})

// Requesters see replies from the team, not from the individual board member
// who wrote them.
export const SUPPORT_REPLY_AUTHOR_NAME = 'Tahti support'

export const MySupportTicketReplySchema = z.object({
  id: z.string(),
  body: z.string(),
  authorName: z.string(),
  /** True for the requester's own follow-up, false for a reply from the board. */
  fromRequester: z.boolean(),
  createdAt: z.coerce.date(),
})

export const MySupportTicketReplyBodySchema = z.object({
  body: z.string().trim().min(1, 'Reply cannot be empty').max(5000),
})

export const MySupportTicketSchema = z.object({
  id: z.string(),
  subject: z.string(),
  message: z.string(),
  category: SupportCategorySchema,
  status: SupportStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  replies: z.array(MySupportTicketReplySchema),
})

export const MySupportTicketListSchema = z.object({
  tickets: z.array(MySupportTicketSchema),
})

export const AdminSupportTicketListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: SupportStatusSchema.optional(),
  category: SupportCategorySchema.optional(),
  // Free-text search across subject, message body, requester email, and
  // requester username/display name (see admin/support.ts GET handler).
  q: z.string().trim().min(1).max(200).optional(),
  /** `true` lists only unresolved tickets where the next move is the board's. */
  awaitingReply: z.enum(['true', 'false']).optional(),
})

export const AdminSupportTicketRowSchema = z.object({
  id: z.string(),
  subject: z.string(),
  category: z.string(),
  status: z.string(),
  artistId: z.string().nullable(),
  artistUsername: z.string().nullable(),
  artistDisplayName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  assignedToId: z.string().nullable(),
  /** List rows only: the requester wrote last (or nobody has answered yet) on
   * a ticket that is not resolved, so the next move is the board's. */
  awaitingReply: z.boolean().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const AdminSupportTicketListSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  tickets: z.array(AdminSupportTicketRowSchema),
})

export const SupportTicketNoteKindSchema = z.enum(['MESSAGE', 'STATUS_CHANGE'])

export const AdminSupportTicketNoteSchema = z.object({
  id: z.string(),
  body: z.string(),
  kind: SupportTicketNoteKindSchema,
  authorId: z.string().nullable(),
  authorDisplayName: z.string().nullable(),
  createdAt: z.coerce.date(),
})

export const AdminSupportTicketDetailSchema = z.object({
  id: z.string(),
  subject: z.string(),
  message: z.string(),
  category: z.string(),
  status: z.string(),
  artistId: z.string().nullable(),
  artistUsername: z.string().nullable(),
  artistDisplayName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  assignedToId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  notes: z.array(AdminSupportTicketNoteSchema),
})

export const AdminSupportTicketCreateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  category: SupportCategorySchema.default('OTHER'),
  artistId: z.string().optional(),
  contactEmail: z.string().email().optional(),
})

export const AdminSupportTicketPatchSchema = z
  .object({
    status: SupportStatusSchema.optional(),
    assignedToId: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })

export const AdminSupportTicketNoteBodySchema = z.object({
  body: z.string().trim().min(1).max(5000),
})

export const TicketIdParamSchema = z.object({
  id: z.coerce.bigint().positive(),
})
