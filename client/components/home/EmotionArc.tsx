"use client";

import { useEffect, useRef, useState } from "react";

/*
 * An illustrative emotional arc: four emotions scored chapter by chapter.
 * The values are hand-shaped to show what the chart looks like — they are not
 * the output of the analysis pipeline.
 */

const CHAPTERS = 12;

const SERIES = [
  {
    name: "Joy",
    color: "#4D8937",
    values: [0.55, 0.62, 0.5, 0.38, 0.3, 0.34, 0.26, 0.2, 0.42, 0.6, 0.74, 0.86],
  },
  {
    name: "Sadness",
    color: "#6B5B95",
    values: [0.18, 0.2, 0.3, 0.42, 0.5, 0.46, 0.62, 0.7, 0.5, 0.34, 0.22, 0.14],
  },
  {
    name: "Fear",
    color: "#8B5E34",
    values: [0.1, 0.16, 0.26, 0.3, 0.44, 0.58, 0.52, 0.66, 0.48, 0.3, 0.18, 0.1],
  },
  {
    name: "Anger",
    color: "#B4695A",
    values: [0.08, 0.12, 0.22, 0.4, 0.34, 0.28, 0.46, 0.38, 0.24, 0.18, 0.1, 0.06],
  },
];

const W = 560;
const H = 260;
const PAD = { top: 20, right: 16, bottom: 34, left: 16 };

const x = (i: number) =>
  PAD.left + (i / (CHAPTERS - 1)) * (W - PAD.left - PAD.right);
const y = (v: number) => PAD.top + (1 - v) * (H - PAD.top - PAD.bottom);

/** Smooth line through the points (Catmull-Rom, drawn as cubic Béziers). */
function smoothPath(values: number[]) {
  const pts = values.map((v, i) => [x(i), y(v)] as const);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const TURN = 7; // chapter index where the story turns (chapter 8)

export default function EmotionArc() {
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  // Draw the lines the first time the chart scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5 shadow-[0px_4px_24px_0px_rgba(142,142,142,0.18)] sm:p-6"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-serif text-lg text-[#113E00]">Emotional arc</span>
        <span className="text-xs uppercase tracking-[0.18em] text-stone-400">
          Illustrative
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Line chart showing joy, sadness, fear and anger rising and falling across twelve chapters, with a turning point at chapter eight."
      >
        {[0.25, 0.5, 0.75].map((v) => (
          <line
            key={v}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            stroke="#e7e5e4"
            strokeDasharray="3 5"
          />
        ))}

        {/* The turning point */}
        <line
          x1={x(TURN)}
          x2={x(TURN)}
          y1={PAD.top - 6}
          y2={H - PAD.bottom}
          stroke="#a8a29e"
          strokeDasharray="2 4"
          className="transition-opacity delay-[1400ms] duration-700"
          style={{ opacity: drawn ? 1 : 0 }}
        />
        <text
          x={x(TURN) + 6}
          y={PAD.top + 4}
          fontSize="11"
          fill="#78716c"
          className="transition-opacity delay-[1400ms] duration-700"
          style={{ opacity: drawn ? 1 : 0 }}
        >
          the turn
        </text>

        {SERIES.map((s, i) => (
          <path
            key={s.name}
            d={smoothPath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.name === "Joy" ? 3 : 2.25}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            style={{
              strokeDashoffset: drawn ? 0 : 1,
              transition: `stroke-dashoffset 1.6s cubic-bezier(0.65, 0, 0.35, 1) ${i * 0.12}s`,
            }}
          />
        ))}

        {Array.from({ length: CHAPTERS }, (_, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 10}
            fontSize="11"
            textAnchor="middle"
            fill="#a8a29e"
          >
            {i + 1}
          </text>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {SERIES.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5 text-sm text-stone-600">
              <span
                className="inline-block h-2 w-4 rounded-full"
                style={{ background: s.color }}
                aria-hidden="true"
              />
              {s.name}
            </li>
          ))}
        </ul>
        <span className="text-xs text-stone-400">Chapter</span>
      </div>
    </div>
  );
}
