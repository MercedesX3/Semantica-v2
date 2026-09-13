"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnalysisStage,
  BookMLMessage,
  ChapterEmotions,
} from "@/workers/bookML.types";

export type BookAnalysisState =
  | { status: "idle" }
  | {
      status: "running";
      message: string;
      stage: AnalysisStage | null;
      progress: number;
    }
  | { status: "complete"; results: ChapterEmotions[] }
  | { status: "error"; error: string };

/**
 * Runs the emotion analysis for a PDF in a Web Worker, so the book is parsed
 * and classified on the reader's device and the page stays responsive.
 */
export function useBookAnalysis() {
  const [state, setState] = useState<BookAnalysisState>({ status: "idle" });
  const workerRef = useRef<Worker | null>(null);

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (file: File) => {
      stop();
      setState({ status: "running", message: "Reading file...", stage: null, progress: 0 });

      const worker = new Worker(new URL("../workers/bookML.worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<BookMLMessage>) => {
        const msg = event.data;
        switch (msg.type) {
          case "STATUS":
            setState((prev) =>
              prev.status === "running"
                ? { ...prev, message: msg.message }
                : prev,
            );
            break;
          case "PROGRESS":
            setState((prev) =>
              prev.status === "running"
                ? { ...prev, stage: msg.stage, progress: msg.value }
                : prev,
            );
            break;
          case "COMPLETE":
            setState({ status: "complete", results: msg.data });
            stop();
            break;
          case "ERROR":
            setState({ status: "error", error: msg.error });
            stop();
            break;
        }
      };

      worker.onerror = (event) => {
        setState({ status: "error", error: event.message || "The analysis worker crashed." });
        stop();
      };

      const arrayBuffer = await file.arrayBuffer();
      worker.postMessage({ arrayBuffer }, [arrayBuffer]);
    },
    [stop],
  );

  const reset = useCallback(() => {
    stop();
    setState({ status: "idle" });
  }, [stop]);

  return { state, start, reset };
}
