"use client";

import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";
import EmotionArc from "@/components/home/EmotionArc";
import type { BookAnalysisState } from "@/hooks/useBookAnalysis";
import {
  EMOTIONS,
  type ChapterEmotions,
  type Emotion,
} from "@/workers/bookML.types";

const STAGE_LABEL = {
  EXTRACTING_TEXT: "Extracting text",
  INFERENCE: "Analyzing emotions",
} as const;

export const EMOTION_COLOR: Record<Emotion, string> = {
  joy: "#4D8937",
  sadness: "#6B5B95",
  anger: "#B4695A",
  fear: "#8B5E34",
  surprise: "#C9A227",
  disgust: "#5E7C73",
  neutral: "#A8A29E",
};

export const capitalize =(word: string) => word[0].toUpperCase() + word.slice(1);

const dominant = (row: ChapterEmotions) =>
  EMOTIONS.filter((e) => e !== "neutral").reduce((best, e) =>
    row[e] > row[best] ? e : best,
  );

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function saveResults(
  results: ChapterEmotions[],
  fileName: string,
  format: "json" | "csv",
) {
  const base = `${fileName.replace(/\.pdf$/i, "")}-emotions`;

  if (format === "json") {
    const payload = {
      source: fileName,
      analyzedAt: new Date().toISOString(),
      emotions: EMOTIONS,
      sections: results,
    };
    download(
      `${base}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    return;
  }

  const header = [
    "chapterIndex",
    "title",
    "wordCount",
    "dominant",
    ...EMOTIONS,
  ];
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = results.map((row) =>
    [
      row.chapterIndex,
      row.title,
      row.wordCount,
      dominant(row),
      ...EMOTIONS.map((e) => row[e]),
    ]
      .map(escape)
      .join(","),
  );
  download(`${base}.csv`, [header.join(","), ...rows].join("\n"), "text/csv");
}

const saveButton =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors duration-300 hover:border-[#4D8937] hover:bg-[#4D8937]/10 hover:text-[#3a6b2b]";

export default function BookAnalysisPanel({
  state,
  fileName,
}: {
  state: BookAnalysisState;
  fileName: string;
}) {
  if (state.status === "idle") return null;

  if (state.status === "running") {
    return (
      <div
        className="mt-6 rounded-lg border border-stone-300 bg-stone-50 p-4"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-stone-700">
          <Loader2 className="h-4 w-4 animate-spin text-[#4D8937]" />
          <span className="font-medium">{state.message}</span>
        </div>
        {state.stage && (
          <>
            <div className="mt-3 flex justify-between text-sm text-stone-500">
              <span>{STAGE_LABEL[state.stage]}</span>
              <span>{state.progress}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-[#4D8937] transition-[width] duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-stone-400">
          Everything runs in your browser — the PDF never leaves your device.
          When it finishes, the emotion scores are saved to Semantica.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
        role="alert"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
        <div>
          <p className="font-medium">Analysis failed</p>
          <p className="text-sm">{state.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-stone-300 bg-white p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-stone-900">
          Emotional breakdown · {state.results.length} sections
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => saveResults(state.results, fileName, "json")}
            className={saveButton}
          >
            <Download className="h-4 w-4" />
            Save JSON
          </button>
          <button
            type="button"
            onClick={() => saveResults(state.results, fileName, "csv")}
            className={saveButton}
          >
            <Download className="h-4 w-4" />
            Save CSV
          </button>
        </div>
      </div>

      <div className="mt-4">
        <EmotionArc
          title="Your book's emotional arc"
          badge={`${state.results.length} sections`}
          xLabel="Section"
          series={EMOTIONS.map((e) => ({
            name: capitalize(e),
            color: EMOTION_COLOR[e],
            values: state.results.map((row) => row[e]),
          }))}
          labels={state.results.map((row) => row.title)}
          scale="auto"
          toggleable
          initiallyHidden={["Neutral"]}
        />
      </div>

      <details className="group mt-4">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          Section breakdown
        </summary>
        <ol className="mt-3 space-y-3">
          {state.results.map((row) => {
            const total = EMOTIONS.reduce((sum, e) => sum + row[e], 0) || 1;
            return (
              <li key={row.chapterIndex}>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-800">{row.title}</span>
                  <span className="text-stone-500">
                    <span className="capitalize">{dominant(row)}</span> ·{" "}
                    {row.wordCount.toLocaleString()} words
                  </span>
                </div>
                <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-stone-100">
                  {EMOTIONS.map((e) => (
                    <div
                      key={e}
                      title={`${e}: ${(row[e] * 100).toFixed(1)}%`}
                      style={{
                        width: `${(row[e] / total) * 100}%`,
                        background: EMOTION_COLOR[e],
                      }}
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}
