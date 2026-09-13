"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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

// Beat between the viewer appearing and the cover starting to lift, so the
// reader sees the closed book before it opens.
const OPEN_DELAY_MS = 450;

interface BookViewerProps {
  book: {
    title: string;
    author: string;
    cover?: string;
  };
  onClose: () => void;
}

export default function BookViewer({ book, onClose }: BookViewerProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Close the book first; the viewer unmounts once the cover has shut
  // (Book reports that through onFullyClosed).
  const requestClose = useCallback(() => {
    setOpen(false);
    setClosing(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      {/* Close button */}
      <button
        onClick={requestClose}
        className="absolute right-6 top-6 z-50 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-white/20"
      >
        Close
      </button>

      {/* Book information */}
      <div className="pointer-events-none absolute left-8 top-8 z-40 text-white">
        <p className="text-sm uppercase tracking-[0.25em] text-purple-400">
          Selected book
        </p>

        <h2 className="mt-2 text-3xl font-bold">{book.title}</h2>

        <p className="mt-1 text-white/60">{book.author}</p>
      </div>

      <p className="pointer-events-none absolute bottom-6 left-1/2 z-40 -translate-x-1/2 text-xs uppercase tracking-[0.2em] text-white/50">
        Click the book to {open ? "close" : "open"} it · drag to look around
      </p>

      {/* Three.js */}
      <Suspense fallback={<div>Loading 3D viewer...</div>}>
        <Canvas
          camera={{
            position: [0, 0.6, 7.5],
            fov: 45,
          }}
        >
          <ambientLight intensity={0.5} />

          <directionalLight position={[3, 5, 5]} intensity={1.6} />

          <Environment preset="studio" environmentIntensity={0.45} />

          <Book
            title={book.title}
            author={book.author}
            open={open}
            closing={closing}
            onToggle={() => !closing && setOpen((previous) => !previous)}
            onFullyClosed={onClose}
          />

          <OrbitControls enablePan={false} minDistance={4} maxDistance={10} />
        </Canvas>
      </Suspense>
    </div>
  );
}
