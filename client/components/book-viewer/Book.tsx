"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import Cover from "./Cover";
import Page, { type PageHandle } from "./Page";
import {
  makeCoverTexture,
  makeTextPageTexture,
  makeTitlePageTexture,
} from "./textures";

/*
 * The book stands facing the camera, spine on the left, like one held up to
 * read. Everything hinges on the spine line (x = 0), so every rotation below is
 * about the Y axis through that line.
 *
 * The opening is one timeline, `progress`, running 0 → 1:
 *   0.00 – 0.42  the front cover swings open over the spine and lands flat
 *   0.25 – 1.00  half the text block moves from the right pile to the left
 *   0.30 – 0.98  a handful of loose pages flip across, one after another
 * Closing plays the same timeline backwards, so pages return in reverse order.
 */

// Book dimensions, in scene units.
const COVER_W = 2.3;
const COVER_H = 3.2;
const COVER_T = 0.06;
const PAGE_INSET = 0.03; // pages sit just inside the cover's edge
const PAGE_W = COVER_W - PAGE_INSET - 0.05;
const PAGE_H = COVER_H - 0.12;
const BLOCK_T = 0.5; // thickness of the whole text block

const FLIP_PAGES = 6;
const OPEN_SECONDS = 2.6;
const CLOSE_SECONDS = 1.8;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const phase = (p: number, start: number, end: number) =>
  clamp01((p - start) / (end - start));
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface BookProps {
  title: string;
  author: string;
  open: boolean;
  closing: boolean;
  onToggle: () => void;
  onFullyClosed: () => void;
}

export default function Book({
  title,
  author,
  open,
  closing,
  onToggle,
  onFullyClosed,
}: BookProps) {
  const progress = useRef(0);
  const closedReported = useRef(false);

  const book = useRef<THREE.Group>(null);
  const frontCover = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Mesh>(null);
  const rightBlock = useRef<THREE.Mesh>(null);
  const leftBlock = useRef<THREE.Mesh>(null);
  const pages = useRef<(PageHandle | null)[]>([]);

  const textures = useMemo(() => {
    const text = makeTextPageTexture(1);
    // The back of a page is seen through the mesh's far side, which mirrors
    // UVs — pre-mirror it so text on left-hand pages reads the right way.
    const textBack = makeTextPageTexture(2);
    textBack.wrapS = THREE.RepeatWrapping;
    textBack.repeat.x = -1;
    textBack.offset.x = 1;
    return {
      cover: makeCoverTexture(title, author),
      titlePage: makeTitlePageTexture(title, author),
      text,
      textBack,
    };
  }, [title, author]);

  useEffect(
    () => () => Object.values(textures).forEach((t) => t.dispose()),
    [textures],
  );

  useEffect(() => {
    if (!closing) closedReported.current = false;
  }, [closing]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30); // don't jump after a background tab
    const seconds = open ? OPEN_SECONDS : CLOSE_SECONDS;
    progress.current = clamp01(
      progress.current + (open ? dt : -dt) / seconds,
    );
    const p = progress.current;

    const cover = easeInOut(phase(p, 0, 0.42));
    const moved = 0.5 * easeInOut(phase(p, 0.25, 1)); // share of block on the left

    // Closed, the book is turned a little so you can see its spine and depth;
    // as it opens it squares up to the camera and slides so the spread is
    // centred rather than the spine.
    if (book.current) {
      book.current.rotation.y = 0.45 * (1 - cover);
      book.current.position.x = -(COVER_W / 2) * (1 - cover);
    }

    // The cover's hinge starts on top of the text block and settles down to
    // the back cover's level, the way a real cover ends up flat on the table.
    const hingeZ = THREE.MathUtils.lerp(COVER_T + BLOCK_T, COVER_T, cover);
    if (frontCover.current) {
      frontCover.current.position.z = hingeZ;
      frontCover.current.rotation.y = -Math.PI * cover;
    }

    if (spine.current) {
      const depth = hingeZ + COVER_T;
      spine.current.scale.z = depth;
      spine.current.position.z = depth / 2;
    }

    const rightT = Math.max(BLOCK_T * (1 - moved), 0.001);
    const leftT = Math.max(BLOCK_T * moved, 0.001);
    const rightTop = COVER_T + rightT;
    const leftTop = COVER_T + leftT;

    if (rightBlock.current) {
      rightBlock.current.scale.z = rightT;
      rightBlock.current.position.z = COVER_T + rightT / 2;
    }
    if (leftBlock.current) {
      leftBlock.current.visible = moved > 0.002;
      leftBlock.current.scale.z = leftT;
      leftBlock.current.position.z = COVER_T + leftT / 2;
    }

    // Loose pages: each has its own window, staggered so they fan across.
    const gap = 0.003;
    for (let k = 0; k < FLIP_PAGES; k += 1) {
      const start = 0.3 + k * 0.075;
      const t = easeInOut(phase(p, start, start + 0.3));
      const restRight = rightTop + (FLIP_PAGES - k) * gap; // first page on top
      const restLeft = leftTop + (k + 1) * gap; // last page flipped on top
      const lift = Math.sin(Math.PI * t) * 0.12; // arc up and over the spine
      pages.current[k]?.update(t, THREE.MathUtils.lerp(restRight, restLeft, t) + lift);
    }

    if (closing && p === 0 && !closedReported.current) {
      closedReported.current = true;
      onFullyClosed();
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onToggle();
  };

  return (
    <group rotation={[-0.22, 0, 0]}>
      <group ref={book} onClick={handleClick}>
        {/* Back cover */}
        <Cover
          width={COVER_W}
          height={COVER_H}
          thickness={COVER_T}
          position={[COVER_W / 2, 0, COVER_T / 2]}
        />

        {/* Spine — its depth follows the front cover's hinge */}
        <mesh ref={spine} position={[-COVER_T / 2, 0, 0]}>
          <boxGeometry args={[COVER_T, COVER_H, 1]} />
          <meshStandardMaterial color="#241b3d" roughness={0.65} />
        </mesh>

        {/* Text block, right-hand pile */}
        <mesh
          ref={rightBlock}
          position={[PAGE_INSET + PAGE_W / 2, 0, 0]}
        >
          <boxGeometry args={[PAGE_W, PAGE_H, 1]} />
          <PaperMaterials top={textures.text} />
        </mesh>

        {/* Text block, left-hand pile (grows as the book opens) */}
        <mesh
          ref={leftBlock}
          position={[-(PAGE_INSET + PAGE_W / 2), 0, 0]}
          visible={false}
        >
          <boxGeometry args={[PAGE_W, PAGE_H, 1]} />
          <PaperMaterials top={textures.text} />
        </mesh>

        {/* Loose pages that flip */}
        {Array.from({ length: FLIP_PAGES }, (_, k) => (
          <Page
            key={k}
            ref={(handle) => {
              pages.current[k] = handle;
            }}
            width={PAGE_W}
            height={PAGE_H}
            offsetX={PAGE_INSET}
            front={k === 0 ? textures.titlePage : textures.text}
            back={textures.textBack}
          />
        ))}

        {/* Front cover, hinged on the spine */}
        <group ref={frontCover} position={[0, 0, COVER_T + BLOCK_T]}>
          <Cover
            width={COVER_W}
            height={COVER_H}
            thickness={COVER_T}
            position={[COVER_W / 2, 0, COVER_T / 2]}
            frontTexture={textures.cover}
          />
        </group>
      </group>
    </group>
  );
}

/** Paper edges on every side, with a printed page on the top (+z) face. */
function PaperMaterials({ top }: { top: THREE.Texture }) {
  // Box face order: +x, -x, +y, -y, +z, -z
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <meshStandardMaterial
          key={i}
          attach={`material-${i}`}
          color="#e9dfc8"
          roughness={1}
        />
      ))}
      <meshStandardMaterial attach="material-4" map={top} roughness={1} />
      <meshStandardMaterial attach="material-5" color="#e9dfc8" roughness={1} />
    </>
  );
}
