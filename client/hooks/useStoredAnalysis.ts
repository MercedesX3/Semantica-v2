"use client";

import { useEffect, useState } from "react";
import { fetchAnalytics, toChapterEmotions } from "@/lib/api";
import type { BookAnalysisState } from "@/hooks/useBookAnalysis";

type Loaded = { bookId: string; title: string; state: BookAnalysisState };

export function useStoredAnalysis(bookId: string | null): {
  state: BookAnalysisState;
  title: string;
} {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!bookId) return;

    const controller = new AbortController();

    fetchAnalytics(bookId, controller.signal)
      .then((data) => {
        setLoaded({
          bookId,
          title: data.metadata?.title ?? "",
          state: {
            status: "complete",
            results: data.chapters.map(toChapterEmotions),
          },
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          bookId,
          title: "",
          state: {
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          },
        });
      });

    return () => controller.abort();
  }, [bookId]);

  if (!bookId) return { state: { status: "idle" }, title: "" };

  if (loaded?.bookId !== bookId) {
    return {
      state: {
        status: "running",
        message: "Fetching analysis...",
        stage: null,
        progress: 0,
      },
      title: "",
    };
  }

  return { state: loaded.state, title: loaded.title };
}
