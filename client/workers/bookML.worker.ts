import * as pdfjsLib from "pdfjs-dist";
import * as pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs";
import { pipeline, env } from "@huggingface/transformers";
import {
  EMOTIONS,
  type BookMLMessage,
  type BookMLRequest,
  type ChapterEmotions,
  type Emotion,
} from "./bookML.types";

const MODEL_ID = "onnx-community/emotion-english-distilroberta-base-ONNX";
const PAGES_PER_SECTION = 25;
const PASSAGE_CHARS = 1200;
const MIN_PASSAGE_CHARS = 30;
const BATCH_SIZE = 16;

(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

env.allowLocalModels = false;

const ctx = self as unknown as {
  postMessage: (message: BookMLMessage) => void;
  onmessage: ((event: MessageEvent<BookMLRequest>) => void) | null;
};

const post = (message: BookMLMessage) => ctx.postMessage(message);

async function pickDevice(): Promise<"webgpu" | "wasm"> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return "wasm";
  try {
    return (await gpu.requestAdapter()) ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

function toPassages(text: string): string[] {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [];
  const passages: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length > PASSAGE_CHARS) {
      passages.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) passages.push(current.trim());

  return passages.filter((p) => p.length > MIN_PASSAGE_CHARS);
}

ctx.onmessage = async (event) => {
  const { arrayBuffer } = event.data;

  try {
    post({ type: "STATUS", message: "Loading PDF..." });

    const pdfDoc = await pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: pdfjsLib.VerbosityLevel.ERRORS,
    }).promise;
    const numPages = pdfDoc.numPages;
    const pagesText: string[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      pagesText.push(
        textContent.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );
      page.cleanup();

      if (i % 5 === 0 || i === numPages) {
        post({
          type: "PROGRESS",
          stage: "EXTRACTING_TEXT",
          value: Math.round((i / numPages) * 100),
        });
      }
    }
    await pdfDoc.destroy();

    const sections: { title: string; passages: string[]; wordCount: number }[] = [];
    for (let i = 0; i < pagesText.length; i += PAGES_PER_SECTION) {
      const text = pagesText.slice(i, i + PAGES_PER_SECTION).join(" ");
      sections.push({
        title: `Section ${sections.length + 1}`,
        passages: toPassages(text),
        wordCount: text.split(/\s+/).filter(Boolean).length,
      });
    }

    const totalPassages = sections.reduce((n, s) => n + s.passages.length, 0);
    if (totalPassages === 0) {
      throw new Error(
        "No readable text found in this PDF. It may be a scanned book without a text layer.",
      );
    }

    post({ type: "STATUS", message: "Initializing model (may take time on first run)..." });

    const device = await pickDevice();
    const classifier = await pipeline("text-classification", MODEL_ID, {
      device,
      dtype: "q8",
    });

    post({ type: "STATUS", message: "Analyzing tones..." });

    const finalResults: ChapterEmotions[] = [];
    let processed = 0;

    for (let s = 0; s < sections.length; s++) {
      const { title, passages, wordCount } = sections[s];
      if (passages.length === 0) continue;

      const totals = Object.fromEntries(EMOTIONS.map((e) => [e, 0])) as Record<Emotion, number>;

      for (let i = 0; i < passages.length; i += BATCH_SIZE) {
        const batch = passages.slice(i, i + BATCH_SIZE);
        const outputs = (await classifier(batch, { top_k: null })) as unknown as {
          label: string;
          score: number;
        }[][];

        for (const scores of outputs) {
          for (const { label, score } of scores) {
            if (label in totals) totals[label as Emotion] += score;
          }
        }

        processed += batch.length;
        post({
          type: "PROGRESS",
          stage: "INFERENCE",
          value: Math.round((processed / totalPassages) * 100),
        });
      }

      const averaged = Object.fromEntries(
        EMOTIONS.map((e) => [e, Number((totals[e] / passages.length).toFixed(4))]),
      ) as Record<Emotion, number>;

      finalResults.push({ chapterIndex: s + 1, title, wordCount, ...averaged });
    }

    post({ type: "COMPLETE", data: finalResults });
  } catch (err) {
    post({ type: "ERROR", error: err instanceof Error ? err.message : String(err) });
  }
};
