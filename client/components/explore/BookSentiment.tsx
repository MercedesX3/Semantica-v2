"use client";

import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import EmotionArc from "@/components/home/EmotionArc";
import { EMOTION_COLOR, capitalize } from "@/components/upload/BookAnalysisPanel";
import { useStoredAnalysis } from "@/hooks/useStoredAnalysis";
import { EMOTIONS, type ChapterEmotions } from "@/workers/bookML.types";

/** Each emotion's share of the whole book, weighted by section length. */
function bookAverages(rows: ChapterEmotions[]) {
  const words = rows.reduce((sum, r) => sum + (r.wordCount || 1), 0) || 1;
  return EMOTIONS.map((e) => ({
    emotion: e,
    value: rows.reduce((sum, r) => sum + r[e] * (r.wordCount || 1), 0) / words,
  }))
    .filter((a) => a.emotion !== "neutral")
    .sort((a, b) => b.value - a.value);
}

const panel =
  "flex h-full min-h-0 flex-col rounded-2xl border border-stone-200 bg-white/80 p-4 backdrop-blur-sm sm:rounded-3xl sm:p-6";

export default function BookSentiment({ bookId }: { bookId: string }) {
  const { state } = useStoredAnalysis(bookId);

  if (state.status === "idle" || state.status === "running") {
    return (
      <div className={`${panel} items-center justify-center gap-2 text-stone-600`} aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-[#4D8937]" />
        <p className="text-sm">Fetching sentiment analysis...</p>
      </div>
    );
  }

  if (state.status === "error") {
    const missing = state.error.startsWith("No analysis found");
    return (
      <div className={`${panel} items-center justify-center gap-3 text-center`} role={missing ? undefined : "alert"}>
        <AlertCircle className={`h-7 w-7 ${missing ? "text-stone-400" : "text-red-700"}`} />
        <p className="font-medium text-stone-800">
          {missing ? "This book hasn't been analyzed yet." : "We couldn't load the analysis."}
        </p>
        <p className="max-w-xs text-sm text-stone-500">
          {missing ? "Upload a copy to generate its emotional breakdown." : state.error}
        </p>
        {missing && (
          <Link
            href="/upload"
            className="mt-1 rounded-lg bg-[#4D8937] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3a6b2b]"
          >
            Upload a book
          </Link>
        )}
      </div>
    );
  }

  const rows = state.results;
  const averages = bookAverages(rows);
  const top = averages[0];
  const peak = top?.value || 1;

  return (
    <div className={`${panel} gap-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 style={{ fontSize: "clamp(20px, 2vw, 24px)", lineHeight: 1.2 }}>Sentiment analysis</h2>
        <span className="text-xs uppercase tracking-[0.18em] text-stone-400">
          {rows.length} sections
        </span>
      </div>

      {top && (
        <p className="text-sm text-stone-600">
          Mostly{" "}
          <span className="font-semibold" style={{ color: EMOTION_COLOR[top.emotion] }}>
            {top.emotion}
          </span>
          , at {Math.round(top.value * 100)}% across the book.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {averages.map(({ emotion, value }) => (
          <li key={emotion} className="flex items-center gap-2 text-sm">
            <span className="w-16 flex-none text-stone-600">{capitalize(emotion)}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(value / peak) * 100}%`, background: EMOTION_COLOR[emotion] }}
              />
            </span>
            <span className="w-9 flex-none text-right tabular-nums text-stone-500">
              {Math.round(value * 100)}%
            </span>
          </li>
        ))}
      </ul>

      <div className="min-h-[280px] flex-1 lg:min-h-0">
        <EmotionArc
          fill
          title="Emotional arc"
          xLabel="Section"
          series={EMOTIONS.map((e) => ({
            name: capitalize(e),
            color: EMOTION_COLOR[e],
            values: rows.map((row) => row[e]),
          }))}
          labels={rows.map((row) => row.title)}
          scale="auto"
          toggleable
          initiallyHidden={["Neutral"]}
        />
      </div>
    </div>
  );
}
