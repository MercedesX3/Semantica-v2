"use client";

import * as THREE from "three";

interface PageProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}

export default function Page({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = "#f5f1e8",
}: PageProps) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={[2.65, 0.035, 3.65]} />

      <meshStandardMaterial
        color={color}
        roughness={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}