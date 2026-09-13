"use client";

import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import * as THREE from "three";

export interface PageHandle {
  /**
   * @param t  flip progress — 0 lying on the right, 1 lying on the left
   * @param z  height of the page's hinge above the back cover
   */
  update: (t: number, z: number) => void;
}

interface PageProps {
  ref?: Ref<PageHandle>;
  width: number;
  height: number;
  /** Gap between the spine and the page's hinge edge. */
  offsetX: number;
  front: THREE.Texture;
  back: THREE.Texture;
}

const SEGMENTS = 32;
// How far the free edge lags behind the hinge mid-turn, in radians. This is
// what makes the page bend like paper instead of swinging like a board.
const CURL = 0.9;

/**
 * A single sheet that turns over the spine.
 *
 * The sheet is a strip of segments. Its angle increases linearly from the
 * hinge to the free edge (angle a at the hinge, a + c at the edge), so the
 * cross-section is a circular arc; positions are the closed-form integral of
 * that angle along the page.
 */
export default function Page({ ref, width, height, offsetX, front, back }: PageProps) {
  const group = useRef<THREE.Group>(null);

  const { geometry, baseX } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, SEGMENTS, 1);
    geo.translate(width / 2, 0, 0); // hinge on x = 0
    const pos = geo.attributes.position;
    const xs = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i += 1) xs[i] = pos.getX(i);
    return { geometry: geo, baseX: xs };
  }, [width, height]);

  useImperativeHandle(
    ref,
    () => ({
      update(t, z) {
        if (group.current) group.current.position.z = z;

        const a = -Math.PI * t;
        const c = CURL * Math.sin(Math.PI * t);
        const pos = geometry.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i += 1) {
          const d = baseX[i];
          let x: number;
          let zz: number;
          if (Math.abs(c) < 1e-4) {
            x = d * Math.cos(a);
            zz = -d * Math.sin(a);
          } else {
            const k = width / c;
            const phi = a + (c * d) / width;
            x = k * (Math.sin(phi) - Math.sin(a));
            zz = k * (Math.cos(phi) - Math.cos(a));
          }
          pos.setX(i, x);
          pos.setZ(i, zz);
        }

        pos.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
      },
    }),
    [geometry, baseX, width],
  );

  return (
    <group ref={group} position={[offsetX, 0, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial map={front} side={THREE.FrontSide} roughness={1} />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial map={back} side={THREE.BackSide} roughness={1} />
      </mesh>
    </group>
  );
}
