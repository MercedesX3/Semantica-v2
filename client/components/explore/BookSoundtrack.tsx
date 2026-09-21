"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Info, Loader2, Music, Pause, Play, X } from "lucide-react";
import { NarrativeScoreEngine } from "@/app/audio/NarrativeScoreEngine";
import { StemAudioEngine } from "@/app/audio/StemAudioEngine";
import { STEM_KEYS, voiceLevels, type StemKey } from "@/app/audio/score";
import type { SoundArchetype } from "@/lib/bookMetadata";
import { EMOTION_COLOR } from "@/components/upload/BookAnalysisPanel";
import { dominantEmotion, sectionHighlights } from "@/lib/soundtrack";
import type { ChapterEmotions } from "@/workers/bookML.types";

/** How long a section change takes to cross over, in seconds. */
const FADE = 2.5;

const VOICE_LABEL: Record<StemKey, string> = {
  neutral: "Neutral",
  joy: "Joy",
  sadness: "Sadness",
  tension: "Tension",
};

/** Each voice borrows the colour of the emotion it stands for. */
const VOICE_COLOR: Record<StemKey, string> = {
  neutral: EMOTION_COLOR.neutral,
  joy: EMOTION_COLOR.joy,
  sadness: EMOTION_COLOR.sadness,
  tension: EMOTION_COLOR.anger,
};

const ZERO_LEVELS: Record<StemKey, number> = {
  neutral: 0,
  joy: 0,
  sadness: 0,
  tension: 0,
};

/** Either engine drives the meters and the crossfade the same way. */
type Engine = StemAudioEngine | NarrativeScoreEngine;

const INFO_ID = "soundtrack-info";

/**
 * What the reader is actually listening to.
 *
 * Covers the panel rather than hanging off the button: the page is locked to
 * the viewport and its ancestors clip, so a popover escaping the card would be
 * cut off. Filling the card keeps it readable at any height.
 */
function SoundtrackInfo({
  archetype,
  onClose,
}: {
  archetype: SoundArchetype | null;
  onClose: () => void;
}) {
  // Escape closes it, as a reader would expect of anything overlaying a page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      id={INFO_ID}
      role="dialog"
      aria-label="How this soundtrack is made"
      className="absolute inset-0 z-10 flex flex-col overflow-y-auto rounded-2xl bg-stone-50 p-4 sm:rounded-3xl sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-serif text-lg text-[#113E00]">How this is made</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-my-1 self-center rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-200/70 hover:text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4D8937]"
          autoFocus
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-stone-600">
        <li>
          <span className="font-medium text-stone-800">A palette per kind of book.</span>{" "}
          The era and subject pick one of four sets — historical, sci-fi, thriller or
          contemporary.
          {archetype && (
            <>
              {" "}
              This book uses{" "}
              <span className="font-medium text-[#4D8937]">{archetype}</span>.
            </>
          )}
        </li>
        <li>
          <span className="font-medium text-stone-800">Four separate recordings.</span>{" "}
          Each palette is a neutral bed, a joyful layer, a sad one and a tense one,
          composed by ElevenLabs and streamed from a CDN. They share a key and tempo so
          they can be played together.
        </li>
        <li>
          <span className="font-medium text-stone-800">Your book moves the faders.</span>{" "}
          The emotion scores read out of the text set how loud each layer is. A section
          that scores high on sadness brings that recording forward and pushes the
          others back — the bars above show the live mix.
        </li>
        <li>
          <span className="font-medium text-stone-800">Sections crossfade.</span> Moving
          between sections fades over {FADE} seconds rather than cutting, so the score
          follows the story instead of interrupting it.
        </li>
        <li>
          <span className="font-medium text-stone-800">Nothing is silent.</span> If a
          palette has not been recorded yet, the music is synthesised in your browser
          from the same scores instead.
        </li>
      </ol>
    </div>
  );
}

export default function BookSoundtrack({
  rows,
  active,
  onSelect,
  archetype,
}: {
  rows: ChapterEmotions[];
  /** Index into `rows`, matching the chart's selection. */
  active: number;
  onSelect: (index: number) => void;
  /** Which recorded stem set to play; null falls back to the generated score. */
  archetype: SoundArchetype | null;
}) {
  const engineRef = useRef<Engine | null>(null);
  const [source, setSource] = useState<"stems" | "generated" | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<Record<StemKey, number>>(ZERO_LEVELS);

  const row = rows[active];
  const highlights = sectionHighlights(rows);
  // While stopped the meters preview where the mix would sit for this section.
  const targets = row ? voiceLevels(row) : ZERO_LEVELS;

  // Follow the section the reader picks, whether from the chart or the track
  // below. Stopped, there's nothing to cross-fade; the preview bars move instead.
  useEffect(() => {
    if (playing && row) engineRef.current?.updateEmotions(row, FADE);
  }, [playing, row]);

  // Read the real gain values back while playing, so the meters show the
  // cross-fade as it happens rather than snapping to the new target.
  useEffect(() => {
    // Stopped, the meters read from `targets` instead, so there's nothing to poll.
    if (!playing) return undefined;
    let frame = 0;
    const tick = () => {
      const engine = engineRef.current;
      if (engine) setLevels(engine.getStemLevels());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  // Leaving the page shouldn't leave an AudioContext running.
  useEffect(() => {
    return () => {
      void engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const toggle = async () => {
    if (!row) return;

    if (playing) {
      engineRef.current?.stop();
      setPlaying(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Built inside the click so the browser counts it as a gesture and lets
      // the AudioContext start.
      let engine = engineRef.current;
      let kind = source;

      if (!engine) {
        // Recorded stems when this book has an archetype and the CDN has it;
        // the generated score whenever that cannot be had, so a missing or
        // unreachable stem set never leaves the reader in silence.
        if (archetype) {
          const stems = new StemAudioEngine();
          try {
            await stems.init();
            await stems.loadArchetype(archetype);
            engine = stems;
            kind = "stems";
          } catch (err) {
            console.warn(
              `[soundtrack] no "${archetype}" stems, using the generated score:`,
              err,
            );
            await stems.dispose();
          }
        }

        if (!engine) {
          const generated = new NarrativeScoreEngine();
          await generated.init();
          engine = generated;
          kind = "generated";
        }

        engineRef.current = engine;
        setSource(kind);
      }

      engine.start(row);
      setPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The score wouldn't start.");
    } finally {
      setLoading(false);
    }
  };

  if (!row) return null;

  const shown = playing ? levels : targets;
  const top = dominantEmotion(row);
  const badge = highlights.get(active);

  return (
    <section className="relative flex h-full min-h-0 flex-col rounded-2xl border border-stone-200 bg-stone-50/70 p-4 shadow-[0px_4px_24px_0px_rgba(142,142,142,0.18)] sm:rounded-3xl sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-serif text-lg text-[#113E00]">Soundtrack</span>
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-[0.18em] text-stone-400">
            {playing ? "Playing" : "4 voices"}
          </span>
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            aria-expanded={showInfo}
            aria-controls={INFO_ID}
            aria-label="How this soundtrack is made"
            className="-my-1 self-center rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-200/70 hover:text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4D8937]"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showInfo && (
        <SoundtrackInfo archetype={archetype} onClose={() => setShowInfo(false)} />
      )}

      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-label={playing ? "Stop the soundtrack" : "Play the soundtrack"}
          className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-linear-80 from-stone-500 to-yellow-800 text-stone-50 shadow-[0px_4px_4px_0px_rgba(142,142,142,0.25)] outline-2 -outline-offset-2 outline-stone-400 transition-all duration-300 ease-out hover:drop-shadow-2xl disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : playing ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="ml-0.5 h-6 w-6" />
          )}
        </button>

        {/* Narrative context for whichever section is selected. */}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-800">
            {row.title}
            {badge && (
              <span className="ml-2 rounded-full bg-[#4D8937]/10 px-2 py-0.5 text-[11px] font-medium tracking-wide text-[#4D8937]">
                {badge.label}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            Mostly{" "}
            <span className="font-medium" style={{ color: EMOTION_COLOR[top] }}>
              {top}
            </span>{" "}
            · {row.wordCount.toLocaleString()} words
          </p>
          <p className="mt-0.5 text-xs text-stone-400">
            {loading
              ? "Tuning the score..."
              : playing
                ? `${source === "stems" ? `${archetype} stems` : "Generated score"} · crossfading over ${FADE}s`
                : "Preview of the mix"}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 text-xs text-red-700" role="alert">
          <AlertCircle className="mt-px h-4 w-4 flex-none" />
          {error}
        </p>
      )}

      {/* Live voice levels: what each layer is actually playing at. */}
      <ul className="mt-4 space-y-2">
        {STEM_KEYS.map((key) => (
          <li key={key} className="flex items-center gap-2 text-xs">
            <span className="w-14 flex-none text-stone-600">{VOICE_LABEL[key]}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
              <span
                className={`block h-full rounded-full${playing ? "" : " transition-[width] duration-700"}`}
                style={{
                  width: `${Math.round(shown[key] * 100)}%`,
                  background: VOICE_COLOR[key],
                  opacity: playing ? 1 : 0.45,
                }}
              />
            </span>
            <span className="w-8 flex-none text-right tabular-nums text-stone-500">
              {Math.round(shown[key] * 100)}%
            </span>
          </li>
        ))}
      </ul>

      {/* The section track, and the accessible way to change section. */}
      <div className="mt-4 lg:mt-auto lg:pt-4">
        <div className="flex flex-wrap gap-1.5">
          {rows.map((section, i) => {
            const isActive = i === active;
            return (
              <button
                key={section.chapterIndex}
                type="button"
                onClick={() => onSelect(i)}
                aria-pressed={isActive}
                title={`${section.title}${highlights.get(i) ? ` — ${highlights.get(i)!.label}` : ""}`}
                className={`relative h-8 min-w-8 rounded-lg px-2 text-xs tabular-nums transition-colors ${
                  isActive
                    ? "bg-[#4D8937] font-semibold text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {i + 1}
                {highlights.has(i) && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-white" : "bg-[#C9A227]"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-400">
          <Music className="h-3.5 w-3.5" />
          Pick a section here or on the arc to hear the mix follow the story.
        </p>
      </div>
    </section>
  );
}
