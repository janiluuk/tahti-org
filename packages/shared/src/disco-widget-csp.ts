// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Pure, runtime-agnostic (works in Node, the browser, and the Edge runtime —
// no Buffer) so both the API (computing a bundle's hash on publish) and the
// sandbox page (computing the <script integrity> attribute from the URL's
// bundleHash) share one implementation instead of two that could drift.
//
// The sandbox route pins a bundle by Subresource Integrity, not a CSP hash
// source: the bundle is served as an external <script src type="module"
// integrity="sha256-...">, never inlined as raw text into the HTML document.
// Inlining arbitrary build output as literal HTML text risks a stray
// "</script" substring inside the code prematurely closing the tag; SRI
// verifies the exact fetched bytes with no such ambiguity, and the sandbox
// route's CSP itself is a fixed 'self'-only policy (see next.config.mjs) —
// the sandbox iframe's lack of allow-same-origin is what actually contains
// the code, not which same-origin script happened to load.

const HEX_BUNDLE_HASH_RE = /^[0-9a-f]{64}$/

export function isValidBundleHashHex(value: string): boolean {
  return HEX_BUNDLE_HASH_RE.test(value)
}

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

/** "sha256-<base64>", the exact value a <script integrity="..."> attribute
 * expects for the given hex sha256 bundle hash. */
export function bundleHashToIntegrity(bundleHashHex: string): string {
  return `sha256-${hexToBase64(bundleHashHex)}`
}
