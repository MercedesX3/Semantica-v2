"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const Canvas = dynamic(
  () => import("@react-three/fiber").then((mod) => mod.Canvas),
  { ssr: false },
);

const OrbitControls = dynamic(
  () => import("@react-three/drei").then((mod) => mod.OrbitControls),
  { ssr: false },
);

const Environment = dynamic(
  () => import("@react-three/drei").then((mod) => mod.Environment),
  { ssr: false },
);

import Book from "./Book";

interface BookViewerProps {
  book: {
    title: string;
    author: string;
    cover?: string;
  };
  onClose: () => void;
}

export default function BookViewer({ book, onClose }: BookViewerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-6 top-6 z-50 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-white/20"
      >
        Close
      </button>

      {/* Book information */}
      <div className="absolute left-8 top-8 z-40 text-white">
        <p className="text-sm uppercase tracking-[0.25em] text-purple-400">
          Selected book
        </p>

        <h2 className="mt-2 text-3xl font-bold">{book.title}</h2>

        <p className="mt-1 text-white/60">{book.author}</p>
      </div>

      {/* Three.js */}
      <Suspense fallback={<div>Loading 3D viewer...</div>}>
        <Canvas
          camera={{
            position: [0, 2, 7],
            fov: 45,
          }}
        >
          <ambientLight intensity={1.5} />

          <directionalLight position={[3, 5, 5]} intensity={3} />

          <Environment preset="studio" />

          <Book title={book.title} author={book.author} />

          <OrbitControls enablePan={false} minDistance={4} maxDistance={9} />
        </Canvas>
      </Suspense>
    </div>
  );
}
