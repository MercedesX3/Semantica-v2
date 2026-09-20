import {
  EMOTIONS,
  type ChapterEmotions,
  type Emotion,
} from "@/workers/bookML.types";

export type ApiChapter = {
  chapterIndex: number;
  title: string;
  wordCount: number;
  valence: number;
  emotions: Partial<Record<Emotion, number>>;
};

export type BookAnalytics = {
  bookId: string;
  metadata: { title: string; author: string; chapterCount: number } | null;
  chapters: ApiChapter[];
};

export type SaveAnalysisRequest = {
  bookId: string;
  title: string;
  author: string;
  chapters: ApiChapter[];
};

export type SaveAnalysisResponse = {
  message: string;
  bookId: string;
};

const API_URL = process.env.NEXT_PUBLIC_LAMBDA_API_URL;

function apiUrl(path: string) {
  if (!API_URL) {
    throw new Error(
      "NEXT_PUBLIC_LAMBDA_API_URL is not set. Add it to client/.env and restart the dev server.",
    );
  }
  return `${API_URL.replace(/\/+$/, "")}${path}`;
}

async function readJson(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      body.error ?? body.message ?? `Request failed (${res.status})`,
    );
  }
  return body;
}

export async function fetchAnalytics(
  bookId: string,
  signal?: AbortSignal,
): Promise<BookAnalytics> {
  const res = await fetch(
    apiUrl(`/analysis/${encodeURIComponent(bookId)}`),
    { signal },
  );
  const body: BookAnalytics = await readJson(res);
  if (!body.metadata) throw new Error(`No analysis found for "${bookId}"`);
  return {
    ...body,
    chapters: [...body.chapters].sort(
      (a, b) => a.chapterIndex - b.chapterIndex,
    ),
  };
}

export async function saveAnalysis(
  payload: SaveAnalysisRequest,
): Promise<SaveAnalysisResponse> {
  const res = await fetch(apiUrl("/analysis"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export const toChapterEmotions = (ch: ApiChapter): ChapterEmotions => ({
  chapterIndex: ch.chapterIndex,
  title: ch.title,
  wordCount: ch.wordCount,
  ...(Object.fromEntries(
    EMOTIONS.map((e) => [e, ch.emotions?.[e] ?? 0]),
  ) as Record<Emotion, number>),
});

/**
 * How positive a section feels, from -1 to 1: joy minus the negative
 * emotions. Surprise and neutral can go either way, so they don't count.
 */
export function valenceOf(row: ChapterEmotions) {
  const negative = row.sadness + row.anger + row.fear + row.disgust;
  return Number(Math.max(-1, Math.min(1, row.joy - negative)).toFixed(4));
}

export const toApiChapter = (row: ChapterEmotions): ApiChapter => ({
  chapterIndex: row.chapterIndex,
  title: row.title,
  wordCount: row.wordCount,
  valence: valenceOf(row),
  emotions: Object.fromEntries(EMOTIONS.map((e) => [e, row[e]])),
});

/**
 * A stable id for a book, derived from its title alone.
 *
 * Deterministic on purpose: uploading the same book again yields the same id, so
 * the save replaces that book's record instead of adding another copy. This used
 * to append a random suffix, which is how the table ended up with four copies of
 * Frankenstein — and why the shelf's clean ids in lib/books.ts never resolved.
 *
 * The author is deliberately not part of it: it defaults to "Unknown" and is
 * corrected afterwards, so including it would change the id out from under a
 * record that was already saved.
 */
export function createBookId(title: string) {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "untitled";
}

/** Removes a book and all its chapters. Used when a retitled book changes id. */
export async function deleteAnalysis(bookId: string): Promise<void> {
  const res = await fetch(apiUrl(`/analysis/${encodeURIComponent(bookId)}`), {
    method: "DELETE",
  });
  await readJson(res);
}
