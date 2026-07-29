// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { loadGalleryTextures, textureAspect } from '../../gallery/shared'
import type { SlideshowTransitionProps } from './types'

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/** Prepended to every preset's fragment shader — maps the full-screen quad's UV into
 * each texture's own "background-size: cover" region, so two images of different
 * native aspect ratios both fill the fixed-aspect slideshow banner without distortion,
 * matching the plain <img style="object-fit:cover"> behavior used outside transitions. */
const COVER_UV_CHUNK = `
  vec2 coverUv(vec2 uv, float containerAspect, float texAspect) {
    vec2 scale = vec2(1.0);
    if (containerAspect > texAspect) {
      scale.y = texAspect / containerAspect;
    } else {
      scale.x = containerAspect / texAspect;
    }
    vec2 offset = (1.0 - scale) * 0.5;
    return uv * scale + offset;
  }
`

export interface ShaderCrossfadeProps extends SlideshowTransitionProps {
  /** GLSL fragment shader body. Has access to: uMapFrom, uMapTo (sampler2D),
   * uAspectFrom, uAspectTo, uContainerAspect (float), uProgress (float, 0..1),
   * uTime (float, seconds since transition start), vUv (vec2), and the
   * coverUv(uv, containerAspect, texAspect) helper. Must write gl_FragColor. */
  fragmentShader: string
}

/** Full-screen-quad WebGL crossfade shared by the particle-dissolve, glitch-wipe, and
 * liquid-distortion presets — only the fragment shader differs between them. Loads both
 * textures, animates uProgress 0→1 over durationMs via requestAnimationFrame, and calls
 * onComplete once. Mounted fresh per transition by the caller (keyed on from/to), so it
 * owns a simple, non-restartable lifecycle. */
export function ShaderCrossfadeTransition({
  fromUrl,
  toUrl,
  durationMs,
  fragmentShader,
  onComplete,
}: ShaderCrossfadeProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new THREE.PlaneGeometry(2, 2)

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMapFrom: { value: null as THREE.Texture | null },
        uMapTo: { value: null as THREE.Texture | null },
        uAspectFrom: { value: 1 },
        uAspectTo: { value: 1 },
        uContainerAspect: { value: 1 },
        uProgress: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: COVER_UV_CHUNK + fragmentShader,
      transparent: true,
    })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    function resize() {
      const w = mount!.clientWidth || 1
      const h = mount!.clientHeight || 1
      renderer.setSize(w, h, false)
      material.uniforms.uContainerAspect.value = w / h
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    let disposed = false
    let raf = 0
    const start = performance.now()

    const { textures, dispose: disposeTex } = loadGalleryTextures([fromUrl, toUrl])
    void textures.then(([texFrom, texTo]) => {
      if (disposed || !texFrom || !texTo) return
      material.uniforms.uMapFrom.value = texFrom
      material.uniforms.uMapTo.value = texTo
      material.uniforms.uAspectFrom.value = textureAspect(texFrom)
      material.uniforms.uAspectTo.value = textureAspect(texTo)

      function animate() {
        if (disposed) return
        const elapsed = performance.now() - start
        const progress = Math.min(1, elapsed / durationMs)
        material.uniforms.uProgress.value = progress
        material.uniforms.uTime.value = elapsed / 1000
        renderer.render(scene, camera)
        if (progress < 1) {
          raf = requestAnimationFrame(animate)
        } else {
          onCompleteRef.current()
        }
      }
      animate()
    })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      disposeTex()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl, toUrl, durationMs])

  return (
    <div
      ref={mountRef}
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  )
}
