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
const TOTAL_SECTIONS = 10;
const PASSAGE_CHARS = 450;
const MIN_PASSAGE_CHARS = 50;
const DEFAULT_SAMPLES_PER_SECTION = 40;

// Regency and Victorian markers that trigger disproportionate disgust/anger
const REGENCY_FALSE_POSITIVES =
  /\b(tolerable|handsome|disagreeable|folly|mortified|civility|censure|contempt|impertinent|insufferable|displeasure|haughty|condescension)\b/i;

(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;
env.allowLocalModels = false;

const ctx = self as unknown as {
  postMessage: (message: BookMLMessage) => void;
  onmessage: ((event: MessageEvent<BookMLRequest>) => void) | null;
};

const post = (message: BookMLMessage) => ctx.postMessage(message);

/**
 * Checks for hardware acceleration capability and selects appropriate batch size.
 */
async function pickDevice(): Promise<{
  device: "webgpu" | "wasm";
  batchSize: number;
}> {
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown> };
    }
  ).gpu;

  if (gpu) {
    try {
      const adapter = await gpu.requestAdapter();
      if (adapter) return { device: "webgpu", batchSize: 32 };
    } catch {
      // Fall through to wasm fallback
    }
  }
  return { device: "wasm", batchSize: 16 };
}

/**
 * Splits text cleanly at punctuation bounds instead of raw character slices.
 * Prevents fragmented context from skewing emotion classifications.
 */
function toSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < MIN_PASSAGE_CHARS) return [];

  const rawSentences = clean.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [];
  const validSentences: string[] = [];
  let buffer = "";

  for (const s of rawSentences) {
    const candidate = (buffer + " " + s).trim();
    if (candidate.length < PASSAGE_CHARS) {
      buffer = candidate;
    } else {
      if (buffer.length >= MIN_PASSAGE_CHARS) validSentences.push(buffer);
      buffer = s.trim();
    }
  }
  if (buffer.length >= MIN_PASSAGE_CHARS) validSentences.push(buffer);

  return validSentences;
}

/**
 * Evenly downsamples across the section timeline to preserve macro arcs
 * while drastically reducing redundant transformer operations.
 */
function samplePassages(passages: string[], maxSamples: number): string[] {
  if (passages.length <= maxSamples) return passages;
  const step = passages.length / maxSamples;
  const sampled: string[] = [];
  for (let i = 0; i < maxSamples; i++) {
    sampled.push(passages[Math.floor(i * step)]);
  }
  return sampled;
}

ctx.onmessage = async (event) => {
  const { arrayBuffer, samplesPerSection = DEFAULT_SAMPLES_PER_SECTION } =
    event.data;

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
        textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" "),
      );
      page.cleanup();

      if (i % 10 === 0 || i === numPages) {
        post({
          type: "PROGRESS",
          stage: "EXTRACTING_TEXT",
          value: Math.round((i / numPages) * 100),
        });
      }
    }
    await pdfDoc.destroy();

    const fullText = pagesText.join(" ");
    const chunkSize = Math.ceil(fullText.length / TOTAL_SECTIONS);

    const sections: { title: string; passages: string[]; wordCount: number }[] =
      [];
    for (let s = 0; s < TOTAL_SECTIONS; s++) {
      const slice = fullText.slice(s * chunkSize, (s + 1) * chunkSize);
      const rawPassages = toSentences(slice);
      const passages = samplePassages(rawPassages, samplesPerSection);
      const wordCount = slice.split(/\s+/).filter(Boolean).length;

      sections.push({
        title: `Section ${s + 1}`,
        passages,
        wordCount,
      });
    }

    const totalPassages = sections.reduce((n, s) => n + s.passages.length, 0);
    if (totalPassages === 0) {
      throw new Error(
        "No readable text found in this PDF. It may be scanned or lack an embedded text layer.",
      );
    }

    post({ type: "STATUS", message: "Initializing model..." });

    const { device, batchSize } = await pickDevice();
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

      const rawTotals = Object.fromEntries(
        EMOTIONS.map((e) => [e, 0]),
      ) as Record<Emotion, number>;

      for (let i = 0; i < passages.length; i += batchSize) {
        const batch = passages.slice(i, i + batchSize);
        const outputs = (await classifier(batch, {
          top_k: null,
        })) as unknown as { label: string; score: number }[][];

        for (let b = 0; b < outputs.length; b++) {
          const scores = outputs[b];
          const textSnippet = batch[b];
          const hasRegencyStyle = REGENCY_FALSE_POSITIVES.test(textSnippet);

          for (const { label, score } of scores) {
            let adjustedScore = score;

            // Scale down modern outrage biases provoked by 19th-century propriety
            if (hasRegencyStyle) {
              if (label === "disgust") adjustedScore *= 0.35;
              if (label === "anger") adjustedScore *= 0.5;
              if (label === "neutral") adjustedScore *= 1.25;
            }

            if (label in rawTotals) {
              rawTotals[label as Emotion] += adjustedScore;
            }
          }
        }

        processed += batch.length;
        post({
          type: "PROGRESS",
          stage: "INFERENCE",
          value: Math.round((processed / totalPassages) * 100),
        });
      }

      // Re-normalize scores across all emotions for this section to sum to 1.0
      const sumOfAllScores =
        Object.values(rawTotals).reduce((a, b) => a + b, 0) || 1;

      const normalizedDistribution = Object.fromEntries(
        EMOTIONS.map((e) => [
          e,
          Number((rawTotals[e] / sumOfAllScores).toFixed(4)),
        ]),
      ) as Record<Emotion, number>;

      finalResults.push({
        chapterIndex: s + 1,
        title,
        wordCount,
        ...normalizedDistribution,
      });
    }

    post({ type: "COMPLETE", data: finalResults });
  } catch (err) {
    post({
      type: "ERROR",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
