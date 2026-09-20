import { EMOTIONS, type ChapterEmotions, type Emotion } from "@/workers/bookML.types";

/**
 * The emotion a section is really about: its highest score, ignoring neutral.
 * Neutral is the biggest number in almost every section, so naming it would
 * tell the reader nothing.
 */
export function dominantEmotion(row: ChapterEmotions): Emotion {
  return EMOTIONS.filter((e) => e !== "neutral").reduce((best, e) =>
    row[e] > row[best] ? e : best,
  );
}

/** How much a section pulls towards the tension stem. */
export const tensionOf = (row: ChapterEmotions) => row.anger + row.fear;

export type SectionHighlight = { index: number; label: string };

/**
 * The turns worth pointing at, found in the data rather than written per book:
 * the section where joy, sadness and tension each run highest.
 *
 * Keyed by position in `rows`, not by chapterIndex, so it lines up with the
 * chart. A section only wins one badge; whichever peak is listed first keeps
 * it, so one dramatic section can't claim all three.
 */
export function sectionHighlights(
  rows: ChapterEmotions[],
): Map<number, SectionHighlight> {
  const peaks: { label: string; score: (row: ChapterEmotions) => number }[] = [
    { label: "Joy peak", score: (r) => r.joy },
    { label: "Sadness peak", score: (r) => r.sadness },
    { label: "Tension peak", score: tensionOf },
  ];

  const taken = new Map<number, SectionHighlight>();

  for (const peak of peaks) {
    let best = -1;
    let bestScore = -Infinity;
    rows.forEach((row, i) => {
      if (taken.has(i)) return;
      const score = peak.score(row);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best >= 0) taken.set(best, { index: best, label: peak.label });
  }

  return taken;
}
