// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

/** Inspired by freefrontend.com — WebGL RGB Shift Image Card */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { GalleryImagesProps } from './types'
import {
  GALLERY_BG,
  createGalleryRenderer,
  disposeScene,
  loadGalleryTextures,
  resizeGalleryRenderer,
  textureAspect,
} from './shared'

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT = `
  uniform sampler2D uMap;
  uniform float uHover;
  uniform float uShift;
  varying vec2 vUv;
  void main() {
    float s = uShift * uHover * 0.035;
    float r = texture2D(uMap, vUv + vec2(s, s * 0.5)).r;
    float g = texture2D(uMap, vUv).g;
    float b = texture2D(uMap, vUv - vec2(s, s * 0.5)).b;
    gl_FragColor = vec4(r, g, b, 1.0);
  }
`

export function RgbShiftGallery({ images }: GalleryImagesProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const root = rootRef.current
    if (!host || !root || images.length === 0) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(GALLERY_BG)
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = 6
    const renderer = createGalleryRenderer(host)
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2(-999, -999)
    const meshes: THREE.Mesh[] = []
    const materials: THREE.ShaderMaterial[] = []
    let disposed = false

    const { textures, dispose: disposeTex } = loadGalleryTextures(images)
    void textures.then((texList) => {
      if (disposed || texList.length === 0) return
      let x = 0
      const gap = 0.3
      const h = 2.0
      for (const texture of texList) {
        const w = h * textureAspect(texture)
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uMap: { value: texture },
            uHover: { value: 0 },
            uShift: { value: 1 },
          },
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
        })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
        mesh.position.x = x + w / 2
        x += w + gap
        scene.add(mesh)
        meshes.push(mesh)
        materials.push(mat)
      }
      root.style.width = `${x * 120}px`
    })

    const onMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    root.addEventListener(
      'scroll',
      () => {
        camera.position.x = root.scrollLeft / 120 + host.clientWidth / 240
      },
      { passive: true },
    )
    renderer.domElement.addEventListener('pointermove', onMove)

    const ro = new ResizeObserver(() => resizeGalleryRenderer(renderer, camera, host))
    ro.observe(host)
    resizeGalleryRenderer(renderer, camera, host)

    let frameId = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(meshes, false)[0]?.object
      for (const mat of materials) {
        const isHover = hit && (hit as THREE.Mesh).material === mat
        mat.uniforms.uHover.value += ((isHover ? 1 : 0) - mat.uniforms.uHover.value) * 0.15
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      ro.disconnect()
      disposeTex()
      disposeScene(renderer, host, [...meshes.map((m) => m.geometry), ...materials])
    }
  }, [images])

  return (
    <div
      ref={rootRef}
      style={{
        overflowX: 'auto',
        borderRadius: 8,
        marginBottom: '1.5rem',
        background: '#0a0f1e',
      }}
      aria-label="RGB Shift gallery — scroll horizontally"
    >
      <div ref={hostRef} style={{ position: 'sticky', left: 0, width: '100%', height: 360 }} />
    </div>
  )
}
