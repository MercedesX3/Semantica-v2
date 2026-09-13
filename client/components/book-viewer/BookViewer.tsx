"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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

import Book, { CAMERA_FOV, CAMERA_POSITION, closedCoverScreenRect } from "./Book";

/*
 * The shelf card becomes the 3D book without a cut:
 *
 *   entering  the backdrop fades up while a DOM copy of the card lifts off the
 *             shelf and flies to the exact spot the 3D cover will render,
 *             restyling itself into that cover on the way
 *   viewing   once the flight has landed AND the scene has drawn a frame, the
 *             canvas fades in underneath, the copy fades out, and the book opens
 *   leaving   after the book has shut, the same thing runs backwards and the
 *             copy settles back into the card's place on the shelf
 */

const FLIGHT_MS = 750;
const HANDOFF_MS = 320;
const OPEN_DELAY_MS = 250; // beat on the closed book before the cover lifts
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const COVER_FONT = "Georgia, 'Times New Roman', serif"; // same as makeCoverTexture

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const toKeyframe = (r: Rect, radius: number) => ({
  left: `${r.left}px`,
  top: `${r.top}px`,
  width: `${r.width}px`,
  height: `${r.height}px`,
  borderRadius: `${radius}px`,
});

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const coverRect = () =>
  closedCoverScreenRect(window.innerWidth, window.innerHeight);

interface BookViewerProps {
  book: {
    title: string;
    author: string;
    cover?: string;
  };
  /** The shelf card that was clicked — the flight starts and ends on it. */
  sourceEl: HTMLElement | null;
  onClose: () => void;
}

export default function BookViewer({ book, sourceEl, onClose }: BookViewerProps) {
  const [leaving, setLeaving] = useState(false);
  const [landed, setLanded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const backdrop = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const cardFace = useRef<HTMLDivElement>(null);
  const coverFace = useRef<HTMLDivElement>(null);

  /** Animate the flying copy between two rects, cross-fading its two faces. */
  const fly = useCallback((from: Rect, to: Rect, toCover: boolean) => {
    const el = flyer.current;
    if (!el) return Promise.resolve();
    const duration = reducedMotion() ? 1 : FLIGHT_MS;
    const opts: KeyframeAnimationOptions = { duration, easing: EASE, fill: "forwards" };

    const flight = el.animate(
      [
        {
          ...toKeyframe(from, toCover ? 8 : 3),
          transform: "none",
          boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
        },
        {
          // Rises toward the reader mid-flight, like picking the book up.
          offset: 0.55,
          transform: "scale(1.04) rotate(-1.5deg)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.45)",
        },
        {
          ...toKeyframe(to, toCover ? 3 : 8),
          transform: "none",
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
        },
      ],
      opts,
    );
    const faceOpts = { ...opts, easing: "ease-in-out" };
    cardFace.current?.animate({ opacity: toCover ? [1, 0] : [0, 1] }, faceOpts);
    coverFace.current?.animate({ opacity: toCover ? [0, 1] : [1, 0] }, faceOpts);
    return flight.finished.then(() => undefined);
  }, []);

  // Entering: lift the card off the shelf. Layout effect, so the copy is in
  // place before the first paint and the real card never visibly blinks out.
  useLayoutEffect(() => {
    const duration = reducedMotion() ? 1 : FLIGHT_MS;
    backdrop.current?.animate(
      { opacity: [0, 1] },
      { duration, easing: "ease-out", fill: "forwards" },
    );

    const from = sourceEl?.getBoundingClientRect() ?? coverRect();
    let cancelled = false;
    fly(from, coverRect(), true).then(() => !cancelled && setLanded(true));
    return () => {
      cancelled = true;
    };
  }, [fly, sourceEl]);

  // The canvas takes over once the flight has landed and the scene has drawn.
  const viewing = landed && sceneReady && !leaving;

  // …and after the handoff cross-fade, the book opens.
  const handedOff = landed && sceneReady;
  useEffect(() => {
    if (!handedOff) return undefined;
    const timer = window.setTimeout(() => setOpen(true), HANDOFF_MS + OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [handedOff]);

  const requestClose = useCallback(() => {
    if (!viewing) return;
    setOpen(false);
    setClosing(true);
  }, [viewing]);

  // Leaving: runs once the 3D book reports its cover has shut.
  const handleFullyClosed = useCallback(() => {
    setLeaving(true);
    window.setTimeout(async () => {
      const duration = reducedMotion() ? 1 : FLIGHT_MS;
      backdrop.current?.animate(
        { opacity: [1, 0] },
        { duration, easing: "ease-in", fill: "forwards" },
      );
      const to = sourceEl?.getBoundingClientRect() ?? coverRect();
      await fly(coverRect(), to, false);
      onClose();
    }, HANDOFF_MS);
  }, [fly, onClose, sourceEl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  const handoff = { transitionDuration: `${HANDOFF_MS}ms` };
  const shownWhileViewing = `transition-opacity ease-out ${
    viewing ? "opacity-100" : "pointer-events-none opacity-0"
  }`;

  // Portalled to <body>: inside the page the overlay would share a stacking
  // context with the page's own controls, and those could paint above it.
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        ref={backdrop}
        className="absolute inset-0 bg-black/80 opacity-0 backdrop-blur-sm"
      />

      {/* Three.js — mounted from the start so it is warm by the time the card lands */}
      <div className={`absolute inset-0 ${shownWhileViewing}`} style={handoff}>
        <Suspense fallback={null}>
          <Canvas
            camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
            onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
          >
            <ambientLight intensity={0.8} />
            <directionalLight position={[3, 5, 5]} intensity={1.4} />
            <Environment preset="studio" environmentIntensity={0.35} />

            <Book
              title={book.title}
              author={book.author}
              cover={book.cover}
              open={open}
              closing={closing}
              onToggle={() => viewing && !closing && setOpen((previous) => !previous)}
              onFullyClosed={handleFullyClosed}
              onReady={() => setSceneReady(true)}
            />

            <OrbitControls enablePan={false} minDistance={4} maxDistance={10} />
          </Canvas>
        </Suspense>
      </div>

      {/* The flying copy of the card */}
      <div
        ref={flyer}
        aria-hidden="true"
        className={`pointer-events-none fixed overflow-hidden transition-opacity ease-out ${
          viewing ? "opacity-0" : "opacity-100"
        }`}
        style={{ ...handoff, containerType: "inline-size" }}
      >
        {/* Face 1: the card as it sits on the shelf */}
        <div
          ref={cardFace}
          className="absolute inset-0"
          style={{
            background: book.cover
              ? `center / cover url(${book.cover})`
              : "linear-gradient(135deg, #3b2f63, #171329)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h3 className="text-lg font-semibold">{book.title}</h3>
            <p className="mt-1 text-sm text-white/70">{book.author}</p>
          </div>
        </div>

        {/* Face 2: the cover the 3D book wears — its image, or the printed
            title cover from makeCoverTexture when there isn't one */}
        {book.cover ? (
          <div
            ref={coverFace}
            className="absolute inset-0 opacity-0"
            style={{ background: `center / cover url(${book.cover})` }}
          />
        ) : (
          <div
            ref={coverFace}
            className="absolute inset-0 opacity-0"
            style={{ background: "linear-gradient(135deg, #3b2f63, #171329)" }}
          >
            <div className="absolute inset-[5.5%] border border-[#d6b46a]/80" />
            {/* Sizes are the texture's canvas pixels ÷ its 512px width, in cqw */}
            <div
              className="absolute inset-x-[11.7%] top-[40%] -translate-y-1/2 text-center font-semibold text-[#e8cf8f]"
              style={{ fontSize: "8.6cqw", lineHeight: "10.55cqw", fontFamily: COVER_FONT }}
            >
              {book.title}
            </div>
            <div
              className="absolute inset-x-[13.7%] top-[78%] text-center italic text-[#e8cf8f]/80"
              style={{
                fontSize: "4.7cqw",
                lineHeight: "6.25cqw",
                marginTop: "-3.125cqw",
                fontFamily: COVER_FONT,
              }}
            >
              {book.author}
            </div>
          </div>
        )}
      </div>

      {/* Chrome — only while the 3D book is on stage */}
      <div className={shownWhileViewing} style={handoff}>
        <button
          onClick={requestClose}
          className="absolute right-6 top-6 z-50 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-white/20"
        >
          Close
        </button>

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
      </div>
    </div>,
    document.body,
  );
}
