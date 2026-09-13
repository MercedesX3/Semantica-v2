export const EMOTIONS = [
  "joy",
  "sadness",
  "anger",
  "fear",
  "surprise",
  "disgust",
  "neutral",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export type ChapterEmotions = {
  chapterIndex: number;
  title: string;
  wordCount: number;
} & Record<Emotion, number>;

export type AnalysisStage = "EXTRACTING_TEXT" | "INFERENCE";

export type BookMLRequest = { arrayBuffer: ArrayBuffer };

export type BookMLMessage =
  | { type: "STATUS"; message: string }
  | { type: "PROGRESS"; stage: AnalysisStage; value: number }
  | { type: "COMPLETE"; data: ChapterEmotions[] }
  | { type: "ERROR"; error: string };
