// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

/** Inspired by freefrontend.com — Infinite 3D Poster Scroll Wall */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { GalleryImagesProps } from './types'
import {
  GALLERY_BG,
  createGalleryRenderer,
  disposeScene,
  loadGalleryTextures,
  resizeGalleryRenderer,
} from './shared'

export function PosterWallGallery({ images }: GalleryImagesProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host || images.length === 0) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(GALLERY_BG)
    scene.fog = new THREE.Fog(GALLERY_BG, 8, 22)

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 40)
    camera.position.set(0, 0, 8)
    camera.rotation.y = -0.35
    camera.rotation.x = 0.08

    const renderer = createGalleryRenderer(host)
    const group = new THREE.Group()
    scene.add(group)

    let disposed = false
    const meshes: THREE.Mesh[] = []

    const { textures, dispose: disposeTex } = loadGalleryTextures(images)
    void textures.then((texList) => {
      if (disposed || texList.length === 0) return
      const cols = Math.min(4, texList.length)
      const posterW = 1.4
      const posterH = 2.0
      const gapX = 0.35
      const gapY = 0.4
      let i = 0
      for (const tex of texList) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const mat = new THREE.MeshBasicMaterial({ map: tex })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(posterW, posterH), mat)
        mesh.position.x = (col - (cols - 1) / 2) * (posterW + gapX)
        mesh.position.y = -row * (posterH + gapY) + 1
        mesh.position.z = -row * 0.15
        group.add(mesh)
        meshes.push(mesh)
        i++
      }
      // Duplicate row for infinite scroll illusion
      for (const tex of texList) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const mat = new THREE.MeshBasicMaterial({ map: tex })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(posterW, posterH), mat)
        mesh.position.x = (col - (cols - 1) / 2) * (posterW + gapX)
        mesh.position.y = -row * (posterH + gapY) + 1
        mesh.position.z = -row * 0.15
        group.add(mesh)
        meshes.push(mesh)
        i++
      }
    })

    const ro = new ResizeObserver(() => resizeGalleryRenderer(renderer, camera, host))
    ro.observe(host)
    resizeGalleryRenderer(renderer, camera, host)

    let frameId = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      group.position.y += 0.008
      if (group.position.y > 4) group.position.y = 0
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      ro.disconnect()
      disposeTex()
      disposeScene(renderer, host, [
        ...meshes.map((m) => m.geometry),
        ...meshes.map((m) => m.material as THREE.Material),
      ])
    }
  }, [images])

  return (
    <div className="ch-gallery-fixed" aria-label="Poster scroll wall gallery">
      <div ref={hostRef} className="ch-gallery-host--fill" />
    </div>
  )
}
