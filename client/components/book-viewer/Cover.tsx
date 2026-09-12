"use client";

import * as THREE from "three";

interface CoverProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  children?: React.ReactNode;
}

export default function Cover({
  position,
  rotation = [0, 0, 0],
  color = "#241b3d",
  children,
}: CoverProps) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={[2.8, 0.15, 3.8]} />

      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.05}
      />

      {children}
    </mesh>
  );
}