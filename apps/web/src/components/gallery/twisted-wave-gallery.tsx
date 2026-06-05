// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

/** Inspired by freefrontend.com — Twisted Wave GLSL Image Gallery */
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
  uniform float uHover;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float dist = distance(uv, vec2(0.5));
    pos.z += sin(dist * 12.0 - uTime * 3.0) * 0.18 * uHover;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const FRAGMENT = `
  uniform sampler2D uMap;
  uniform float uScrollPower;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    vec2 c = vec2(0.5);
    float d = distance(uv, c);
    float warp = 1.0 + uScrollPower * pow(d, 1.4) * 0.4;
    uv = c + (uv - c) * warp;
    gl_FragColor = texture2D(uMap, uv);
  }
`

export function TwistedWaveGallery({ images }: GalleryImagesProps) {
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
    let xCursor = 0
    const gap = 0.35
    const planeHeight = 2.2
    let disposed = false

    const { textures, dispose: disposeTex } = loadGalleryTextures(images)

    void textures.then((texList) => {
      if (disposed || texList.length === 0) return
      xCursor = 0
      for (const texture of texList) {
        const aspect = textureAspect(texture)
        const width = planeHeight * aspect
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uMap: { value: texture },
            uHover: { value: 0 },
            uTime: { value: 0 },
            uScrollPower: { value: 0 },
          },
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
        })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, planeHeight, 32, 32), mat)
        mesh.position.x = xCursor + width / 2
        xCursor += width + gap
        scene.add(mesh)
        meshes.push(mesh)
        materials.push(mat)
      }
      root.style.width = `${Math.max(xCursor - gap, 1) * 120}px`
    })

    const onMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    const onLeave = () => pointer.set(-999, -999)
    let scrollPower = 0
    let lastScrollLeft = root.scrollLeft
    let lastScrollTs = performance.now()
    const onScroll = () => {
      const now = performance.now()
      const dt = Math.max(now - lastScrollTs, 1)
      scrollPower = Math.min(
        1,
        scrollPower + (Math.abs(root.scrollLeft - lastScrollLeft) / dt) * 0.02,
      )
      lastScrollLeft = root.scrollLeft
      lastScrollTs = now
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerleave', onLeave)

    const ro = new ResizeObserver(() => resizeGalleryRenderer(renderer, camera, host))
    ro.observe(host)
    resizeGalleryRenderer(renderer, camera, host)

    const clock = new THREE.Clock()
    let frameId = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      scrollPower *= 0.92
      const t = clock.getElapsedTime()
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(meshes, false)[0]?.object
      camera.position.x = root.scrollLeft / 120 + host.clientWidth / 240
      for (const mat of materials) {
        const isHover = hit && (hit as THREE.Mesh).material === mat
        mat.uniforms.uHover.value += ((isHover ? 1 : 0) - mat.uniforms.uHover.value) * 0.12
        mat.uniforms.uTime.value = t
        mat.uniforms.uScrollPower.value = scrollPower
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      ro.disconnect()
      root.removeEventListener('scroll', onScroll)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerleave', onLeave)
      disposeTex()
      disposeScene(renderer, host, [...meshes.map((m) => m.geometry), ...materials])
    }
  }, [images])

  return (
    <div
      ref={rootRef}
      className="ch-gallery-scroll ch-gallery-scroll--wave"
      aria-label="Twisted Wave gallery — scroll horizontally"
    >
      <div ref={hostRef} className="ch-gallery-host--sticky" />
    </div>
  )
}
