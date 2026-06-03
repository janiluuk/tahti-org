// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(32, 'Username too long')
    .regex(/^[a-z0-9_-]+$/, 'Username may only contain lowercase letters, numbers, - and _'),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(64, 'Display name too long')
    .trim(),
})

export type RegisterInput = z.infer<typeof RegisterSchema>

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof LoginSchema>

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
})

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>
