"use client";

import { useEffect, useRef, useState } from "react";

/*
 * A chapter-by-chapter emotional arc.
 *
 * With no props it shows the home page's illustrative arc: hand-shaped values
 * that demonstrate the chart, not output of the analysis pipeline. Pass
 * `series` and `labels` to plot real results.
 */

export interface ArcSeries {
  name: string;
  color: string;
  values: number[];
}

interface EmotionArcProps {
  series?: ArcSeries[];
  /** One label per point, shown in the hover tooltip. */
  labels?: string[];
  title?: string;
  badge?: string;
  xLabel?: string;
  /** Marks a point on the arc, e.g. the story's turn. */
  marker?: { index: number; label: string } | null;
  /**
   * `fixed` plots 0–100%. `auto` fits the tallest visible line, for real
   * scores that sit well below the top of the chart.
   */
  scale?: "fixed" | "auto";
  /** Let the reader show and hide lines from the legend. */
  toggleable?: boolean;
  initiallyHidden?: string[];
}

const ILLUSTRATIVE: ArcSeries[] = [
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
const AXIS_GUTTER = 28;
const MAX_TICKS = 12;

/** Smooth line through the points (Catmull-Rom, drawn as cubic Béziers). */
function smoothPath(pts: (readonly [number, number])[]) {
  if (pts.length === 0) return "";
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

const percent = (v: number) => `${Math.round(v * 100)}%`;

export default function EmotionArc({
  series = ILLUSTRATIVE,
  labels,
  title = "Emotional arc",
  badge = series === ILLUSTRATIVE ? "Illustrative" : undefined,
  xLabel = "Chapter",
  marker = series === ILLUSTRATIVE ? { index: 7, label: "the turn" } : null,
  scale = "fixed",
  toggleable = false,
  initiallyHidden = [],
}: EmotionArcProps) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [hidden, setHidden] = useState(() => new Set(initiallyHidden));
  const [hover, setHover] = useState<number | null>(null);

  const count = Math.max(0, ...series.map((s) => s.values.length));
  const visible = series.filter((s) => !hidden.has(s.name));

  const peak = Math.max(0, ...visible.flatMap((s) => s.values));
  const yMax =
    scale === "fixed"
      ? 1
      : Math.min(1, Math.max(0.05, Math.ceil((peak * 1.1) / 0.05) * 0.05));

  const left = PAD.left + (scale === "auto" ? AXIS_GUTTER : 0);
  const x = (i: number) =>
    count <= 1 ? (left + W - PAD.right) / 2 : left + (i / (count - 1)) * (W - left - PAD.right);
  const y = (v: number) =>
    PAD.top + (1 - Math.min(v, yMax) / yMax) * (H - PAD.top - PAD.bottom);

  const tickEvery = Math.ceil(count / MAX_TICKS);

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

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || count === 0) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((event.clientX - rect.left) / rect.width) * W;
    const i =
      count <= 1
        ? 0
        : Math.round(((vx - left) / (W - left - PAD.right)) * (count - 1));
    setHover(Math.max(0, Math.min(count - 1, i)));
  };

  return (
    <div
      ref={ref}
      className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5 shadow-[0px_4px_24px_0px_rgba(142,142,142,0.18)] sm:p-6"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-serif text-lg text-[#113E00]">{title}</span>
        {badge && (
          <span className="text-xs uppercase tracking-[0.18em] text-stone-400">
            {badge}
          </span>
        )}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={`Line chart of ${series.map((s) => s.name.toLowerCase()).join(", ")} across ${count} ${xLabel.toLowerCase()}s.`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          {[0.25, 0.5, 0.75].map((f) => (
            <g key={f}>
              <line
                x1={left}
                x2={W - PAD.right}
                y1={y(f * yMax)}
                y2={y(f * yMax)}
                stroke="#e7e5e4"
                strokeDasharray="3 5"
              />
              {scale === "auto" && (
                <text
                  x={left - 8}
                  y={y(f * yMax) + 3.5}
                  fontSize="10"
                  textAnchor="end"
                  fill="#a8a29e"
                >
                  {percent(f * yMax)}
                </text>
              )}
            </g>
          ))}

          {marker && marker.index < count && (
            <g
              className="transition-opacity delay-[1400ms] duration-700"
              style={{ opacity: drawn ? 1 : 0 }}
            >
              <line
                x1={x(marker.index)}
                x2={x(marker.index)}
                y1={PAD.top - 6}
                y2={H - PAD.bottom}
                stroke="#a8a29e"
                strokeDasharray="2 4"
              />
              <text x={x(marker.index) + 6} y={PAD.top + 4} fontSize="11" fill="#78716c">
                {marker.label}
              </text>
            </g>
          )}

          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top - 6}
              y2={H - PAD.bottom}
              stroke="#78716c"
              strokeWidth={1}
            />
          )}

          {series.map((s, i) => {
            const pts = s.values.map((v, j) => [x(j), y(v)] as const);
            const isHidden = hidden.has(s.name);
            return (
              <g
                key={s.name}
                style={{ opacity: isHidden ? 0 : 1, transition: "opacity 300ms ease-out" }}
              >
                <path
                  d={smoothPath(pts)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={i === 0 ? 3 : 2.25}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1"
                  style={{
                    strokeDashoffset: drawn ? 0 : 1,
                    transition: `stroke-dashoffset 1.6s cubic-bezier(0.65, 0, 0.35, 1) ${i * 0.12}s`,
                  }}
                />
                {(count === 1 || hover !== null) &&
                  !isHidden &&
                  pts
                    .filter((_, j) => count === 1 || j === hover)
                    .map(([px, py]) => (
                      <circle
                        key={px}
                        cx={px}
                        cy={py}
                        r={4}
                        fill="#fff"
                        stroke={s.color}
                        strokeWidth={2}
                      />
                    ))}
              </g>
            );
          })}

          {Array.from({ length: count }, (_, i) =>
            i % tickEvery === 0 || i === count - 1 ? (
              <text
                key={i}
                x={x(i)}
                y={H - 10}
                fontSize="11"
                textAnchor="middle"
                fill={hover === i ? "#44403c" : "#a8a29e"}
              >
                {i + 1}
              </text>
            ) : null,
          )}
        </svg>

        {hover !== null && visible.length > 0 && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-xl border border-stone-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
            style={
              x(hover) > W / 2
                ? { right: `${100 - (x(hover) / W) * 100 + 2}%` }
                : { left: `${(x(hover) / W) * 100 + 2}%` }
            }
          >
            <div className="mb-1 font-semibold text-stone-800">
              {labels?.[hover] ?? `${xLabel} ${hover + 1}`}
            </div>
            {[...visible]
              .sort((a, b) => (b.values[hover] ?? 0) - (a.values[hover] ?? 0))
              .map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-stone-600">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="tabular-nums text-stone-800">
                    {percent(s.values[hover] ?? 0)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => {
            const swatch = (
              <span
                className="inline-block h-2 w-4 rounded-full"
                style={{ background: s.color }}
                aria-hidden="true"
              />
            );
            return (
              <li key={s.name}>
                {toggleable ? (
                  <button
                    type="button"
                    onClick={() => toggle(s.name)}
                    aria-pressed={!hidden.has(s.name)}
                    className={`flex items-center gap-1.5 rounded-full text-sm transition-opacity hover:text-stone-900 ${
                      hidden.has(s.name) ? "text-stone-400 opacity-50" : "text-stone-600"
                    }`}
                  >
                    {swatch}
                    {s.name}
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-stone-600">
                    {swatch}
                    {s.name}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <span className="text-xs text-stone-400">{xLabel}</span>
      </div>
    </div>
  );
}
