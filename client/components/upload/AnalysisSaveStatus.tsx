"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Loader2, Pencil, RotateCw } from "lucide-react";
import { createBookId, saveAnalysis, toApiChapter } from "@/lib/api";
import type { ChapterEmotions } from "@/workers/bookML.types";

type SaveState =
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; error: string };

type Details = { title: string; author: string };

/** "PrideAndPrejudice_final.pdf" → "Pride And Prejudice final" */
function titleFromFileName(fileName: string) {
  return (
    fileName
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim() || "Untitled"
  );
}

const input =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none transition-colors focus:border-[#4D8937] focus:ring-2 focus:ring-[#4D8937]/20";

const primary =
  "inline-flex items-center gap-1.5 rounded-lg bg-[#4D8937] px-4 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-[#3a6b2b] disabled:cursor-not-allowed disabled:opacity-60";

const secondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors duration-300 hover:border-[#4D8937] hover:bg-[#4D8937]/10 hover:text-[#3a6b2b]";

/**
 * Saves a finished upload analysis as soon as it arrives, then shows where it
 * lives. The book id is fixed for this analysis, so correcting the title or
 * author re-saves over the same record instead of creating a second one.
 */
export default function AnalysisSaveStatus({
  results,
  fileName,
}: {
  results: ChapterEmotions[];
  fileName: string;
}) {
  const [details, setDetails] = useState<Details>(() => ({
    title: titleFromFileName(fileName),
    author: "Unknown",
  }));
  const [bookId] = useState(() => createBookId(details.title));
  const [save, setSave] = useState<SaveState>({ status: "saving" });
  const [editing, setEditing] = useState<Details | null>(null);
  const savedFor = useRef<ChapterEmotions[] | null>(null);

  const persist = async (next: Details) => {
    try {
      await saveAnalysis({
        bookId,
        title: next.title,
        author: next.author,
        chapters: results.map(toApiChapter),
      });
      setDetails(next);
      setSave({ status: "saved" });
    } catch (err) {
      setSave({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Once per analysis — the ref keeps React's development double-run of
  // effects from posting the same book twice.
  useEffect(() => {
    if (savedFor.current === results) return;
    savedFor.current = results;
    void persist(details);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const retry = () => {
    setSave({ status: "saving" });
    void persist(details);
  };

  const submitEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const next = {
      title: editing.title.trim() || details.title,
      author: editing.author.trim() || "Unknown",
    };
    setEditing(null);
    setSave({ status: "saving" });
    void persist(next);
  };

  if (editing) {
    return (
      <form
        onSubmit={submitEdit}
        className="mt-4 rounded-lg border border-stone-300 bg-white p-4 sm:p-5"
      >
        <p className="font-medium text-stone-900">Edit saved details</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-stone-600">
            Title
            <input
              className={input}
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              required
              maxLength={200}
              autoFocus
            />
          </label>
          <label className="block text-sm text-stone-600">
            Author
            <input
              className={input}
              value={editing.author}
              onChange={(e) => setEditing({ ...editing, author: e.target.value })}
              placeholder="Unknown"
              maxLength={200}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={primary} disabled={!editing.title.trim()}>
            Save changes
          </button>
          <button type="button" className={secondary} onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 ${
        save.status === "error"
          ? "border-red-200 bg-red-50"
          : "border-[#4D8937]/30 bg-[#4D8937]/5"
      }`}
      role={save.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {save.status === "saving" && (
        <div className="flex items-center gap-2 text-[#3a6b2b]">
          <Loader2 className="h-5 w-5 flex-none animate-spin" />
          <span className="font-medium">Saving analysis to Semantica...</span>
        </div>
      )}

      {save.status === "saved" && (
        <>
          <div className="min-w-0 text-[#3a6b2b]">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 flex-none" />
              <span className="font-medium">Analysis saved</span>
            </div>
            <p className="mt-0.5 truncate pl-7 text-sm text-stone-600">
              {details.title} · {details.author}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} onClick={() => setEditing(details)}>
              <Pencil className="h-4 w-4" />
              Edit details
            </button>
            <Link href={`/analysis/${encodeURIComponent(bookId)}`} className={primary}>
              View saved analysis →
            </Link>
          </div>
        </>
      )}

      {save.status === "error" && (
        <>
          <div className="flex min-w-0 items-start gap-2 text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
            <div className="min-w-0">
              <p className="font-medium">Couldn&apos;t save this analysis</p>
              <p className="text-sm break-words">{save.error}</p>
            </div>
          </div>
          <button type="button" className={secondary} onClick={retry}>
            <RotateCw className="h-4 w-4" />
            Try again
          </button>
        </>
      )}
    </div>
  );
}
