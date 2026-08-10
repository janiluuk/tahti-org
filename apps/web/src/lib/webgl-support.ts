// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Context creation succeeding doesn't mean it's hardware-accelerated — a
 * GPU-blocklisted driver, remote desktop, or sandboxed browser profile can
 * silently land on a CPU rasterizer (SwiftShader, llvmpipe/Mesa, ANGLE's
 * D3D11 WARP fallback) instead. Our visualizer scenes are 10-100x too heavy
 * for that, so callers should treat this the same as "WebGL unavailable". */
export function isSoftwareWebglRenderer(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): boolean {
  const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info')
  if (!dbgInfo) return false
  const name = String(gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)).toLowerCase()
  return /swiftshader|llvmpipe|software|microsoft basic render|d3d11 warp/.test(name)
}
