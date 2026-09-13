"use client";

import * as THREE from "three";

interface CoverProps {
  width: number;
  height: number;
  thickness: number;
  position: [number, number, number];
  color?: string;
  /** Printed on the outside (+z) face. */
  frontTexture?: THREE.Texture;
}

/** A cover board. Outside faces +z; the inside carries the endpaper. */
export default function Cover({
  width,
  height,
  thickness,
  position,
  color = "#241b3d",
  frontTexture,
}: CoverProps) {
  // Box face order: +x, -x, +y, -y, +z, -z
  return (
    <mesh position={position}>
      <boxGeometry args={[width, height, thickness]} />
      {[0, 1, 2, 3].map((i) => (
        <meshStandardMaterial
          key={i}
          attach={`material-${i}`}
          color={color}
          roughness={0.65}
        />
      ))}
      <meshStandardMaterial
        attach="material-4"
        color={frontTexture ? "#ffffff" : color}
        map={frontTexture ?? null}
        roughness={0.6}
      />
      <meshStandardMaterial attach="material-5" color="#d9cbb0" roughness={0.9} />
    </mesh>
  );
}
