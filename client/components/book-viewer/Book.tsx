"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import Cover from "./Cover";
import Page from "./Page";

interface BookProps {
  title: string;
  author: string;
}

export default function Book({
  title,
  author,
}: BookProps) {
  const [isOpen, setIsOpen] = useState(false);

  const leftCover = useRef<THREE.Group>(null);
  const rightCover = useRef<THREE.Group>(null);

  const leftPage = useRef<THREE.Group>(null);
  const rightPage = useRef<THREE.Group>(null);

  useFrame(() => {
    const target = isOpen ? Math.PI * 0.48 : 0;

    if (leftCover.current) {
      leftCover.current.rotation.y = THREE.MathUtils.lerp(
        leftCover.current.rotation.y,
        -target,
        0.08
      );
    }

    if (rightCover.current) {
      rightCover.current.rotation.y = THREE.MathUtils.lerp(
        rightCover.current.rotation.y,
        target,
        0.08
      );
    }

    if (leftPage.current) {
      leftPage.current.rotation.y = THREE.MathUtils.lerp(
        leftPage.current.rotation.y,
        -target,
        0.08
      );
    }

    if (rightPage.current) {
      rightPage.current.rotation.y = THREE.MathUtils.lerp(
        rightPage.current.rotation.y,
        target,
        0.08
      );
    }
  });

  return (
    <group
      position={[0, -1.5, 0]}
      rotation={[0.05, 0, 0]}
      onClick={(event) => {
        event.stopPropagation();
        setIsOpen((previous) => !previous);
      }}
    >
      {/* Back cover */}
      <Cover
        position={[0, 0, -0.05]}
        color="#302252"
      />

      {/* Left cover */}
      <group
        ref={leftCover}
        position={[-1.4, 0.1, 0]}
      >
        <Cover
          position={[1.4, 0, 0]}
          color="#241b3d"
        />
      </group>

      {/* Right cover */}
      <group
        ref={rightCover}
        position={[1.4, 0.1, 0]}
      >
        <Cover
          position={[-1.4, 0, 0]}
          color="#241b3d"
        />
      </group>

      {/* Left page */}
      <group
        ref={leftPage}
        position={[-1.32, 0.18, 0]}
      >
        <Page
          position={[1.32, 0, 0]}
        />
      </group>

      {/* Right page */}
      <group
        ref={rightPage}
        position={[1.32, 0.18, 0]}
      >
        <Page
          position={[-1.32, 0, 0]}
        />
      </group>

      {/* Center binding */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.12, 0.2, 3.7]} />
        <meshStandardMaterial color="#171222" />
      </mesh>

      {/* Book title */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.02, 0.02, 0.02]} />
      </mesh>
    </group>
  );
}