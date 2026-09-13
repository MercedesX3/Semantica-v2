"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import Cover from "./Cover";
import Page, { type PageHandle } from "./Page";
import {
  loadImageCoverTexture,
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

export const CAMERA_FOV = 45;
const CAMERA_DISTANCE = 7.5;
const CAMERA_LIFT = 0.08; // height per unit of distance, so the viewing angle holds
const SPREAD_MARGIN = 1.15; // open spread width as a share of the visible width

/**
 * Where the camera sits for a viewport of this aspect ratio. On narrow screens
 * it backs away until the open two-page spread fits across the width.
 */
export function cameraPosition(aspect: number): [number, number, number] {
  const halfFov = THREE.MathUtils.degToRad(CAMERA_FOV / 2);
  const fitWidth = (COVER_W * SPREAD_MARGIN) / (Math.tan(halfFov) * aspect);
  const distance = Math.max(CAMERA_DISTANCE, fitWidth);
  return [0, distance * CAMERA_LIFT, distance];
}
const BOOK_TILT = -0.22; // leans the top of the book away from the camera

/**
 * Where the closed book's front cover lands on screen, in CSS pixels, for a
 * canvas filling a `width` × `height` viewport. The DOM card flies to this
 * rectangle before handing off to the 3D book, so the two line up exactly.
 * Mirrors the transforms applied in <Book> at progress 0.
 */
export function closedCoverScreenRect(width: number, height: number) {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 100);
  camera.position.set(...cameraPosition(width / height));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const tilt = new THREE.Matrix4().makeRotationX(BOOK_TILT);
  const z = 2 * COVER_T + BLOCK_T;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const v = new THREE.Vector3((sx * COVER_W) / 2, (sy * COVER_H) / 2, z)
        .applyMatrix4(tilt)
        .project(camera);
      const px = ((v.x + 1) / 2) * width;
      const py = ((1 - v.y) / 2) * height;
      left = Math.min(left, px);
      right = Math.max(right, px);
      top = Math.min(top, py);
      bottom = Math.max(bottom, py);
    }
  }
  return { left, top, width: right - left, height: bottom - top };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const phase = (p: number, start: number, end: number) =>
  clamp01((p - start) / (end - start));
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface BookProps {
  title: string;
  author: string;
  /** Cover image URL; without one the book gets a printed title cover. */
  cover?: string;
  open: boolean;
  closing: boolean;
  onToggle: () => void;
  onFullyClosed: () => void;
  /** Called once the scene has drawn its first frame. */
  onReady?: () => void;
}

export default function Book({
  title,
  author,
  cover,
  open,
  closing,
  onToggle,
  onFullyClosed,
  onReady,
}: BookProps) {
  const progress = useRef(0);
  const closedReported = useRef(false);
  const readyReported = useRef(false);

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

  // The image cover loads before the scene reports ready, so the handoff from
  // the DOM card never shows the fallback cover first.
  const [imageCover, setImageCover] = useState<{
    src: string;
    texture: THREE.Texture | null;
  } | null>(null);

  useEffect(() => {
    if (!cover) return undefined;
    let cancelled = false;
    let loaded: THREE.Texture | null = null;
    loadImageCoverTexture(cover)
      .then((texture) => {
        loaded = texture;
        if (cancelled) texture.dispose();
        else setImageCover({ src: cover, texture });
      })
      .catch(() => !cancelled && setImageCover({ src: cover, texture: null }));
    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [cover]);

  const coverSettled = !cover || imageCover?.src === cover;
  const frontTexture =
    (imageCover && imageCover.src === cover && imageCover.texture) || textures.cover;

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

    // Closed, the book faces the camera squarely — that is the pose the shelf
    // card morphs into. It swings a little toward the reader while the cover
    // lifts, and slides so the open spread ends up centred rather than the spine.
    if (book.current) {
      book.current.rotation.y = 0.2 * Math.sin(Math.PI * cover);
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

    if (coverSettled && !readyReported.current) {
      readyReported.current = true;
      onReady?.();
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onToggle();
  };

  return (
    <group rotation={[BOOK_TILT, 0, 0]}>
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
            frontTexture={frontTexture}
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
