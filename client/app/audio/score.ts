import type { ChapterEmotions } from "@/workers/bookML.types";

/**
 * How a section's emotion scores become music.
 *
 * Kept free of the Web Audio API so the mapping can be read, reasoned about and
 * checked on its own; NarrativeScoreEngine turns these numbers into sound.
 */

export const STEM_KEYS = ["neutral", "joy", "sadness", "tension"] as const;

export type StemKey = (typeof STEM_KEYS)[number];

/**
 * The raw pull of each voice, straight from the scores.
 *
 * Scores are shares of a section, so the strongest one rarely passes ~0.4; each
 * voice is scaled up so a dominant emotion can reach full weight, and tension
 * answers to anger and fear together.
 */
export function stemWeights(emotions: ChapterEmotions): Record<StemKey, number> {
  return {
    neutral: Math.min(1.0, emotions.neutral * 1.4),
    joy: Math.min(1.0, emotions.joy * 2.2),
    sadness: Math.min(1.0, emotions.sadness * 2.4),
    tension: Math.min(1.0, (emotions.anger + emotions.fear) * 1.8),
  };
}

/**
 * How far the loudest voice pushes the others down. Raw weights sit in a narrow
 * band — nothing below ~0.17 across most of a book — so played as-is every voice
 * is always audible and the harmony never really changes. Squaring the weights
 * and normalising to the loudest turns that balance into a real foreground and
 * background.
 */
const CONTRAST = 2;

/**
 * What each voice actually plays at, 0 to 1, with the loudest always at 1.
 *
 * Both the engine and the UI meters read from here, so the bars show the mix
 * that is playing.
 */
export function voiceLevels(emotions: ChapterEmotions): Record<StemKey, number> {
  const raw = stemWeights(emotions);
  const shaped = STEM_KEYS.map((k) => Math.pow(raw[k], CONTRAST));
  const peak = Math.max(...shaped, 1e-6);
  return Object.fromEntries(
    STEM_KEYS.map((k, i) => [k, shaped[i] / peak]),
  ) as Record<StemKey, number>;
}

/**
 * Each voice owns its own pitches, so changing the balance changes the harmony
 * rather than just the volume: joy carries the major third, sadness the minor
 * third, tension a semitone cluster, and neutral bare fifths that commit to
 * neither.
 */
export const VOICE_PITCHES: Record<StemKey, number[]> = {
  // A2 and E3 — an open fifth, no third to colour it either way.
  neutral: [110.0, 164.81],
  // A major pentatonic up top: A4 B4 C#4 E5 F#5 A5.
  joy: [440.0, 493.88, 554.37, 659.26, 739.99, 880.0],
  // A minor with its ninth: A3 C4 E4 B4.
  sadness: [220.0, 261.63, 329.63, 493.88],
  // A1 against B♭1, plus the tritone E♭2.
  tension: [55.0, 58.27, 77.78],
};

export type VoiceParams = {
  /** Gain weight, 0 to 1. */
  level: number;
  /** Lowpass corner, in Hz. */
  cutoff: number;
  /**
   * Notes per second for the voices that play notes; for the drones this is the
   * pulse rate of the filter movement instead.
   */
  rate: number;
  /** Oscillator spread, in cents. */
  detune: number;
};

/** Lerp, for turning a level into a musical range. */
const span = (level: number, low: number, high: number) =>
  low + (high - low) * level;

/**
 * The musical settings for one section: a dominant voice opens up its filter and
 * moves faster, a receding one gets darker and sparser.
 */
export function voiceParams(
  emotions: ChapterEmotions,
): Record<StemKey, VoiceParams> {
  const level = voiceLevels(emotions);

  return {
    neutral: {
      level: level.neutral,
      cutoff: span(level.neutral, 220, 600),
      rate: 0, // a continuous drone; nothing to schedule
      detune: 4,
    },
    joy: {
      level: level.joy,
      cutoff: span(level.joy, 900, 5800),
      rate: span(level.joy, 1.2, 6), // an arpeggio that quickens
      detune: 2,
    },
    sadness: {
      level: level.sadness,
      cutoff: span(level.sadness, 400, 1300),
      rate: span(level.sadness, 0.12, 0.32), // a swell every 3 to 8 seconds
      detune: 6,
    },
    tension: {
      level: level.tension,
      cutoff: span(level.tension, 160, 660),
      rate: span(level.tension, 2, 8), // filter pulse, faster as it grips
      detune: span(level.tension, 12, 32),
    },
  };
}

/**
 * A small seeded random source, so a chapter always renders the same music and a
 * rendering can be compared against an earlier one.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
