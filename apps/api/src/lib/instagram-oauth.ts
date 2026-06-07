// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'
import { decryptSocialToken, encryptSocialToken } from './social-post.js'

const FB_AUTH_URL = 'https://www.facebook.com/v21.0/dialog/oauth'
const GRAPH_API = 'https://graph.facebook.com/v21.0'

// Instagram auto-posting requires a professional (business/creator) account
// connected to a Facebook Page, accessed through the Meta Graph API —
// "Facebook Login for Business" rather than a dedicated Instagram OAuth.
export const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'business_management',
]

export interface InstagramTokenPair {
  accessToken: string
  igUserId: string
  username: string
}

interface GraphTokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: { message?: string; type?: string }
}

async function graphTokenRequest(params: URLSearchParams): Promise<string> {
  const res = await fetch(`${GRAPH_API}/oauth/access_token?${params.toString()}`)
  const data = (await res.json()) as GraphTokenResponse
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? `Instagram token error (${res.status})`)
  }
  return data.access_token
}

export function buildInstagramAuthorizeUrl(params: { state: string }): string {
  const q = new URLSearchParams({
    client_id: config.instagram.clientId,
    redirect_uri: config.instagram.redirectUri,
    scope: INSTAGRAM_OAUTH_SCOPES.join(','),
    state: params.state,
    response_type: 'code',
  })
  return `${FB_AUTH_URL}?${q.toString()}`
}

/** Exchanges the OAuth code for a short-lived user token, then upgrades it to a long-lived (60d) token. */
export async function exchangeInstagramCode(code: string): Promise<string> {
  const shortLived = await graphTokenRequest(
    new URLSearchParams({
      client_id: config.instagram.clientId,
      client_secret: config.instagram.clientSecret,
      redirect_uri: config.instagram.redirectUri,
      code,
    }),
  )
  return graphTokenRequest(
    new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: config.instagram.clientId,
      client_secret: config.instagram.clientSecret,
      fb_exchange_token: shortLived,
    }),
  )
}

interface FacebookPage {
  id: string
  access_token: string
  instagram_business_account?: { id: string; username?: string }
}

/**
 * Walks the user's connected Facebook Pages to find one with a linked
 * Instagram professional account, returning the page access token (used for
 * all subsequent Graph API calls against that IG user) and the IG account.
 */
export async function fetchInstagramAccount(userAccessToken: string): Promise<InstagramTokenPair> {
  const res = await fetch(
    `${GRAPH_API}/me/accounts?fields=id,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userAccessToken)}`,
  )
  const data = (await res.json()) as { data?: FacebookPage[]; error?: { message?: string } }
  if (!res.ok || !data.data) {
    throw new Error(data.error?.message ?? `Instagram account lookup failed (${res.status})`)
  }

  const page = data.data.find((p) => p.instagram_business_account)
  if (!page?.instagram_business_account) {
    throw new Error(
      'No Instagram professional account is linked to your Facebook Pages. Connect your Instagram account to a Facebook Page as a business or creator account first.',
    )
  }

  return {
    accessToken: page.access_token,
    igUserId: page.instagram_business_account.id,
    username: page.instagram_business_account.username ?? page.instagram_business_account.id,
  }
}

/**
 * Publishes an image post to Instagram via the two-step Graph API container
 * flow: create a media container, then publish it. Instagram has no
 * text-only post type, so an image URL is required (use release artwork or
 * a channel gallery image — reachable over the public internet, not localhost).
 */
export async function postToInstagram(params: {
  accessToken: string
  igUserId: string
  caption: string
  imageUrl: string
}): Promise<string> {
  const createRes = await fetch(`${GRAPH_API}/${params.igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: params.imageUrl,
      caption: params.caption.slice(0, 2200),
      access_token: params.accessToken,
    }),
  })
  const created = (await createRes.json()) as { id?: string; error?: { message?: string } }
  if (!createRes.ok || !created.id) {
    throw new Error(created.error?.message ?? `Instagram media create failed (${createRes.status})`)
  }

  const publishRes = await fetch(`${GRAPH_API}/${params.igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: created.id,
      access_token: params.accessToken,
    }),
  })
  const published = (await publishRes.json()) as { id?: string; error?: { message?: string } }
  if (!publishRes.ok || !published.id) {
    throw new Error(
      published.error?.message ?? `Instagram media publish failed (${publishRes.status})`,
    )
  }
  return published.id
}

export function encodeInstagramTokens(tokens: InstagramTokenPair): string {
  return encryptSocialToken(JSON.stringify(tokens))
}

export function decodeInstagramTokens(enc: string): InstagramTokenPair {
  return JSON.parse(decryptSocialToken(enc)) as InstagramTokenPair
}
