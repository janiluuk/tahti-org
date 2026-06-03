// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

/** Inspired by freefrontend.com — Cinematic Zoom Blur Image Gallery */
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GalleryNavButton, GalleryShell } from './gallery-shell'
import type { GalleryImagesProps } from './types'
import {
  GALLERY_BG,
  createGalleryRenderer,
  disposeScene,
  loadGalleryTextures,
  resizeGalleryRenderer,
} from './shared'

const FRAGMENT = `
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uProgress;
  uniform vec2 uMouse;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    vec2 c = vec2(0.5) + uMouse * 0.05;
    float dist = distance(uv, c);
    float blur = uProgress * (1.0 - uProgress) * 6.0;
    vec2 dir = normalize(uv - c + 0.0001);
    vec2 o = dir * blur * dist * 0.15;
    vec4 a = texture2D(uTexA, uv + o);
    vec4 b = texture2D(uTexB, uv - o);
    float t = smoothstep(0.0, 1.0, uProgress);
    gl_FragColor = mix(a, b, t);
  }
`

export function ZoomBlurGallery({ images }: GalleryImagesProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const prevIndexRef = useRef(0)
  const startTransitionRef = useRef<(() => void) | null>(null)

  const go = useCallback(
    (delta: number) => {
      if (images.length < 2) return
      setIndex((i) => (i + delta + images.length) % images.length)
    },
    [images.length],
  )

  useEffect(() => {
    indexRef.current = index
    startTransitionRef.current?.()
  }, [index])

  useEffect(() => {
    const host = hostRef.current
    if (!host || images.length === 0) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(GALLERY_BG)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10)
    camera.position.z = 2.2
    const renderer = createGalleryRenderer(host)

    const uniforms = {
      uTexA: { value: null as THREE.Texture | null },
      uTexB: { value: null as THREE.Texture | null },
      uProgress: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    }
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: FRAGMENT,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8, 1, 1), material)
    scene.add(mesh)

    let texList: THREE.Texture[] = []
    let fromIdx = 0
    let toIdx = 0
    let progress = 0
    let animating = false
    let disposed = false

    const { textures, dispose: disposeTex } = loadGalleryTextures(images)
    void textures.then((list) => {
      if (disposed || list.length === 0) return
      texList = list
      fromIdx = indexRef.current % list.length
      uniforms.uTexA.value = list[fromIdx]
      uniforms.uTexB.value = list[fromIdx]
    })

    const advance = () => {
      if (texList.length < 2 || animating) return
      const to = indexRef.current % texList.length
      const from = prevIndexRef.current % texList.length
      if (from === to) return
      animating = true
      progress = 0
      fromIdx = from
      toIdx = to
      prevIndexRef.current = to
      uniforms.uTexA.value = texList[fromIdx]
      uniforms.uTexB.value = texList[toIdx]
    }

    startTransitionRef.current = advance

    const onMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      uniforms.uMouse.value.x = (e.clientX - rect.left) / rect.width - 0.5
      uniforms.uMouse.value.y = (e.clientY - rect.top) / rect.height - 0.5
    }
    renderer.domElement.addEventListener('pointermove', onMove)

    const ro = new ResizeObserver(() => resizeGalleryRenderer(renderer, camera, host))
    ro.observe(host)
    resizeGalleryRenderer(renderer, camera, host)

    let frameId = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      if (animating) {
        progress += 0.025
        uniforms.uProgress.value = progress
        if (progress >= 1) {
          animating = false
          progress = 0
          uniforms.uProgress.value = 0
          fromIdx = toIdx
          uniforms.uTexA.value = texList[fromIdx]
          uniforms.uTexB.value = texList[fromIdx]
        }
      }
      renderer.render(scene, camera)
    }
    animate()

    const timer = window.setInterval(() => {
      if (texList.length > 1 && !animating) {
        setIndex((i) => (i + 1) % texList.length)
      }
    }, 6000)

    return () => {
      disposed = true
      clearInterval(timer)
      cancelAnimationFrame(frameId)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      disposeTex()
      disposeScene(renderer, host, [mesh.geometry, material])
    }
  }, [images])

  return (
    <GalleryShell
      label="Cinematic Zoom Blur gallery"
      controls={
        images.length > 1 ? (
          <>
            <GalleryNavButton onClick={() => go(-1)}>Prev</GalleryNavButton>
            <GalleryNavButton onClick={() => go(1)}>Next</GalleryNavButton>
          </>
        ) : null
      }
    >
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
    </GalleryShell>
  )
}
