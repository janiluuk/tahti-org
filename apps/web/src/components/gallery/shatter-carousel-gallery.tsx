// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

/** Inspired by freefrontend.com — Shattering Image Gallery Transition */
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

const GRID = 24

const VERTEX = `
  uniform float uShatter;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    vec2 cell = floor(vUv * ${GRID}.0);
    vec2 cellUv = fract(vUv * ${GRID}.0) - 0.5;
    float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
    vec2 dir = normalize(cellUv + 0.001);
    pos.xy += dir * uShatter * (0.15 + h * 0.25);
    pos.z += uShatter * h * 0.8;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const FRAGMENT = `
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uMap, vUv);
  }
`

export function ShatterCarouselGallery({ images }: GalleryImagesProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const triggerRef = useRef<(() => void) | null>(null)

  const go = useCallback(
    (delta: number) => {
      if (images.length < 2) return
      setIndex((i) => (i + delta + images.length) % images.length)
    },
    [images.length],
  )

  useEffect(() => {
    indexRef.current = index
    triggerRef.current?.()
  }, [index])

  useEffect(() => {
    const host = hostRef.current
    if (!host || images.length === 0) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(GALLERY_BG)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10)
    camera.position.z = 2.2
    const renderer = createGalleryRenderer(host)

    let texList: THREE.Texture[] = []
    let mesh: THREE.Mesh | null = null
    let material: THREE.ShaderMaterial | null = null
    let shatter = 0
    let phase: 'idle' | 'out' | 'swap' | 'in' = 'idle'
    let disposed = false

    const { textures, dispose: disposeTex } = loadGalleryTextures(images)
    void textures.then((list) => {
      if (disposed || list.length === 0) return
      texList = list
      material = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: list[indexRef.current % list.length] },
          uShatter: { value: 0 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
      })
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8, GRID, GRID), material)
      scene.add(mesh)
    })

    triggerRef.current = () => {
      if (texList.length < 2 || phase !== 'idle' || !material) return
      phase = 'out'
    }

    const ro = new ResizeObserver(() => resizeGalleryRenderer(renderer, camera, host))
    ro.observe(host)
    resizeGalleryRenderer(renderer, camera, host)

    let frameId = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      if (material) {
        if (phase === 'out') {
          shatter += 0.04
          material.uniforms.uShatter.value = shatter
          if (shatter >= 1) {
            phase = 'swap'
            shatter = 1
            material.uniforms.uMap.value = texList[indexRef.current % texList.length]
          }
        } else if (phase === 'swap') {
          phase = 'in'
        } else if (phase === 'in') {
          shatter -= 0.04
          material.uniforms.uShatter.value = Math.max(0, shatter)
          if (shatter <= 0) phase = 'idle'
        }
      }
      renderer.render(scene, camera)
    }
    animate()

    const timer = window.setInterval(() => {
      if (texList.length > 1 && phase === 'idle') setIndex((i) => (i + 1) % texList.length)
    }, 7000)

    return () => {
      disposed = true
      clearInterval(timer)
      cancelAnimationFrame(frameId)
      ro.disconnect()
      disposeTex()
      const disposables: Array<{ dispose: () => void }> = []
      if (mesh) disposables.push(mesh.geometry, mesh.material as THREE.Material)
      disposeScene(renderer, host, disposables)
    }
  }, [images])

  return (
    <GalleryShell
      label="Shatter carousel gallery"
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
