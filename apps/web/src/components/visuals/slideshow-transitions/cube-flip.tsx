// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { loadGalleryTextures, textureAspect } from '../../gallery/shared'
import type { SlideshowTransitionProps } from './types'

function fitCover(texture: THREE.Texture, containerAspect: number) {
  const texAspect = textureAspect(texture)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  if (containerAspect > texAspect) {
    texture.repeat.set(1, texAspect / containerAspect)
    texture.offset.set(0, (1 - texture.repeat.y) / 2)
  } else {
    texture.repeat.set(containerAspect / texAspect, 1)
    texture.offset.set((1 - texture.repeat.x) / 2, 0)
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** The banner rotates in 3D like a turning cube face — the current image on the front,
 * the next image on the back, revealed as the group turns past 90°. Unlike the other
 * three presets this needs real geometry (two planes glued back-to-back), not a
 * fragment-shader crossfade, so it doesn't share ShaderCrossfadeTransition. */
export function CubeFlipTransition({
  fromUrl,
  toUrl,
  durationMs,
  onComplete,
}: SlideshowTransitionProps) {
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
    const fov = 50
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100)
    const visibleHeight = 2
    camera.position.z = visibleHeight / (2 * Math.tan((fov * Math.PI) / 180 / 2))

    const size = visibleHeight * 0.98
    const group = new THREE.Group()

    const frontMat = new THREE.MeshBasicMaterial({ transparent: true })
    const backMat = new THREE.MeshBasicMaterial({ transparent: true })
    const frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), frontMat)
    const backMesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), backMat)
    backMesh.rotation.y = Math.PI
    backMesh.scale.x = -1 // undo the mirroring the 180° rotation introduces
    group.add(frontMesh, backMesh)
    scene.add(group)

    function resize() {
      const w = mount!.clientWidth || 1
      const h = mount!.clientHeight || 1
      renderer.setSize(w, h, false)
      const aspect = w / h
      camera.aspect = aspect
      camera.updateProjectionMatrix()
      group.scale.x = aspect
      if (frontMat.map) fitCover(frontMat.map, aspect)
      if (backMat.map) fitCover(backMat.map, aspect)
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
      const aspect = (mount!.clientWidth || 1) / (mount!.clientHeight || 1)
      fitCover(texFrom, aspect)
      fitCover(texTo, aspect)
      frontMat.map = texFrom
      backMat.map = texTo
      frontMat.needsUpdate = true
      backMat.needsUpdate = true

      function animate() {
        if (disposed) return
        const elapsed = performance.now() - start
        const progress = Math.min(1, elapsed / durationMs)
        group.rotation.y = easeInOutCubic(progress) * Math.PI
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
      frontMesh.geometry.dispose()
      backMesh.geometry.dispose()
      frontMat.dispose()
      backMat.dispose()
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
