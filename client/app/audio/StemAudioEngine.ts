import { createRunningContext, isRunning } from "@/app/audio/audioContext";
import { STEM_KEYS, stemWeights, type StemKey } from "@/app/audio/score";
import type { SoundArchetype } from "@/lib/bookMetadata";
import type { ChapterEmotions } from "@/workers/bookML.types";

/*
 * The sample-based mixer: four looping stems, crossfaded by chapter emotion.
 *
 * Stems are generated once per archetype by scripts/generate-stems.mjs and
 * served from CloudFront, so the music a book gets depends on the kind of book
 * it is. The mix weights come from score.ts, shared with the UI meters, so the
 * bars show what is actually playing.
 */

/** Where the generated stems are served from. */
const CDN_BASE = process.env.NEXT_PUBLIC_AUDIO_CDN_URL ?? "";

/**
 * Overlap between one pass of a stem and the next.
 *
 * ElevenLabs has no loop-point support and the stems were not written to loop,
 * so playing them with `loop = true` clicks audibly at the seam. Instead each
 * pass is scheduled to overlap the previous one and the two are crossfaded.
 */
const CROSSFADE_SECONDS = 0.6;

/** How far ahead passes are queued, and how often we top the queue up. */
const SCHEDULE_AHEAD = 2.0;
const TICK_MS = 250;

/** Equal-power curves: the overlap is a stem's tail against its own head, which
 *  is uncorrelated material, so a linear fade would dip in the middle. */
const CURVE_POINTS = 64;
const FADE_IN = new Float32Array(CURVE_POINTS);
const FADE_OUT = new Float32Array(CURVE_POINTS);
for (let i = 0; i < CURVE_POINTS; i += 1) {
  const t = i / (CURVE_POINTS - 1);
  FADE_IN[i] = Math.sqrt(t);
  FADE_OUT[i] = Math.sqrt(1 - t);
}

/**
 * How far a stem may be lifted or cut to match its siblings.
 *
 * Wider than the raw level differences need, because the filters below throw
 * away most of what a stem contains — a highpass at 1kHz on a low recording
 * leaves very little — and that loss has to be made back. Measured after
 * filtering, historical's stems land about 23dB apart. Still bounded, so a
 * genuinely silent stem is not amplified into its own noise floor.
 */
const TRIM_RANGE = { min: 0.25, max: 10 };

/**
 * The register each stem is held to.
 *
 * Generated independently, the stems crowd into the same part of the spectrum:
 * measured against each other, historical's neutral and sadness came back 0.83
 * cosine-similar and sci-fi's neutral and joy 0.91, so two chapters with
 * completely different mixes still sounded the same. They are different
 * performances though, not the same file twice, so filtering genuinely
 * separates them rather than shaping two copies of one recording.
 *
 * Fading between a bass rumble, a low bed, a mid voice and a bright top is
 * audible in a way that fading between four mid-range drones is not.
 */
const STEM_FILTER: Record<
  StemKey,
  { type: BiquadFilterType; frequency: number; Q: number }
> = {
  tension: { type: "lowpass", frequency: 260, Q: 0.7 },
  neutral: { type: "lowpass", frequency: 700, Q: 0.7 },
  sadness: { type: "bandpass", frequency: 1100, Q: 0.6 },
  joy: { type: "highpass", frequency: 1000, Q: 0.7 },
};

type Stem = {
  buffer: AudioBuffer;
  /** Holds this stem to its own register; see STEM_FILTER. */
  filter: BiquadFilterNode;
  /** The emotion-driven fader for this stem. */
  gainNode: GainNode;
  /** When the next pass of this stem should begin, on the audio clock. */
  nextStart: number;
  /**
   * Loudness compensation for this stem.
   *
   * The stems are generated independently and come back at wildly different
   * levels — as much as 22dB apart within one archetype, with sci-fi's "joy"
   * twelve times quieter than its "neutral". Without this a chapter at full joy
   * would be inaudible under a neutral bed at a fifth of the level, and the
   * meters would be describing a mix nobody could hear. The weight from the ML
   * scores is multiplied by this so the faders mean what they say.
   */
  trim: number;
};

/**
 * The level of a stem *after* its filter, which is what the listener hears.
 *
 * Measuring the raw buffer would misjudge every stem, since a highpass at 1kHz
 * throws away most of what a low recording contains. A few seconds from the
 * middle is representative and renders far faster than real time.
 */
async function measureFilteredRms(
  buffer: AudioBuffer,
  spec: (typeof STEM_FILTER)[StemKey],
): Promise<number> {
  const seconds = Math.min(5, buffer.duration);
  const rate = buffer.sampleRate;
  const offline = new OfflineAudioContext(1, Math.floor(seconds * rate), rate);

  const source = offline.createBufferSource();
  source.buffer = buffer;

  const filter = offline.createBiquadFilter();
  filter.type = spec.type;
  filter.frequency.value = spec.frequency;
  filter.Q.value = spec.Q;

  source.connect(filter);
  filter.connect(offline.destination);
  // Sample from the middle: the opening may be a fade-in.
  source.start(0, buffer.duration * 0.3, seconds);

  return measureRms(await offline.startRendering());
}

/** Average level of a buffer, subsampled — this runs on 90 seconds of audio. */
function measureRms(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const step = 4;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    sum += data[i] * data[i];
    count += 1;
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

export class StemAudioEngine {
  private audioCtx: AudioContext | null = null;
  private voiceDuckFilter: BiquadFilterNode | null = null;
  private stems = new Map<StemKey, Stem>();
  private timer: ReturnType<typeof setInterval> | null = null;

  private archetype: SoundArchetype | null = null;
  private isLoaded = false;
  private isPlaying = false;

  /**
   * Creates the AudioContext and the output chain. Fetches nothing.
   *
   * Call this first, straight out of the tap: it starts the context while the
   * gesture is still live, so the stem download that follows cannot outlive it.
   */
  public async init(): Promise<void> {
    if (this.audioCtx) return;

    const ctx = await createRunningContext();
    this.audioCtx = ctx;

    // Notches 2kHz to leave headroom for audiobook narration.
    const duck = ctx.createBiquadFilter();
    duck.type = "peaking";
    duck.frequency.value = 2000;
    duck.Q.value = 1.0;
    duck.gain.value = -4.0;
    duck.connect(ctx.destination);
    this.voiceDuckFilter = duck;
  }

  /**
   * Fetches and decodes the four stems for one archetype.
   *
   * Throws if the CDN is unreachable or unconfigured, so the caller can fall
   * back to the generated score rather than leaving the reader in silence.
   */
  public async loadArchetype(archetype: SoundArchetype): Promise<void> {
    if (!this.audioCtx) await this.init();
    const ctx = this.audioCtx!;

    if (this.isLoaded && this.archetype === archetype) return;
    if (!CDN_BASE) {
      throw new Error(
        "NEXT_PUBLIC_AUDIO_CDN_URL is not set — run terraform apply and copy audio_cdn_url into client/.env.",
      );
    }

    this.stop();
    this.stems.clear();
    this.isLoaded = false;

    const base = CDN_BASE.replace(/\/+$/, "");
    const loaded = await Promise.all(
      STEM_KEYS.map(async (key) => {
        const url = `${base}/audio/${archetype}/stem_${key}.mp3`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${url} returned ${res.status}`);
        const buffer = await ctx.decodeAudioData(await res.arrayBuffer());

        const spec = STEM_FILTER[key];
        const filter = ctx.createBiquadFilter();
        filter.type = spec.type;
        filter.frequency.value = spec.frequency;
        filter.Q.value = spec.Q;
        filter.connect(this.voiceDuckFilter!);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.connect(filter);

        // Not `as const`: the trim is filled in below, once every stem's level
        // is known and they can be compared against each other.
        return [
          key,
          { buffer, filter, gainNode, nextStart: 0, trim: 1 },
          await measureFilteredRms(buffer, spec),
        ] as [StemKey, Stem, number];
      }),
    );

    // Match the stems to each other rather than to a fixed target, so the
    // archetype keeps its own overall loudness while the four sit level.
    const levels = loaded.map(([, , rms]) => rms).sort((a, b) => a - b);
    const reference = (levels[1] + levels[2]) / 2 || 1;

    for (const [key, stem, rms] of loaded) {
      stem.trim =
        rms > 0
          ? Math.min(TRIM_RANGE.max, Math.max(TRIM_RANGE.min, reference / rms))
          : 1;
      this.stems.set(key, stem);
    }
    this.archetype = archetype;
    this.isLoaded = true;
  }

  public start(initialEmotions?: ChapterEmotions): void {
    if (!this.audioCtx || !this.isLoaded || this.isPlaying) return;
    const ctx = this.audioCtx;

    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    for (const stem of this.stems.values()) {
      stem.gainNode.gain.cancelScheduledValues(now);
      stem.gainNode.gain.setValueAtTime(0, now);
      stem.nextStart = now + 0.08;
    }

    this.isPlaying = true;
    this.schedulePasses();
    this.timer = setInterval(() => this.schedulePasses(), TICK_MS);

    if (initialEmotions) this.updateEmotions(initialEmotions, 1.2);
  }

  /** Keeps every stem's loop queue topped up a couple of seconds ahead. */
  private schedulePasses(): void {
    const ctx = this.audioCtx;
    if (!ctx || !this.isPlaying) return;

    const horizon = ctx.currentTime + SCHEDULE_AHEAD;

    for (const stem of this.stems.values()) {
      const duration = stem.buffer.duration;
      const overlap = Math.min(CROSSFADE_SECONDS, duration / 3);
      // Guard against a zero-length buffer pinning this loop.
      if (duration <= 0.1) continue;

      let budget = 8;
      while (stem.nextStart < horizon && budget > 0) {
        this.schedulePass(ctx, stem, Math.max(stem.nextStart, ctx.currentTime), overlap);
        // The next pass starts before this one ends; that overlap is the fade.
        stem.nextStart += duration - overlap;
        budget -= 1;
      }
    }
  }

  /** One pass of a stem, faded in at the head and out at the tail. */
  private schedulePass(ctx: AudioContext, stem: Stem, at: number, overlap: number): void {
    const source = ctx.createBufferSource();
    source.buffer = stem.buffer;

    const env = ctx.createGain();
    const duration = stem.buffer.duration;
    env.gain.setValueAtTime(0, at);
    env.gain.setValueCurveAtTime(FADE_IN, at, overlap);
    env.gain.setValueCurveAtTime(FADE_OUT, at + duration - overlap, overlap);

    source.connect(env);
    env.connect(stem.gainNode);
    source.start(at);
    source.stop(at + duration + 0.05);
    source.onended = () => {
      source.disconnect();
      env.disconnect();
    };
  }

  /** Moves the mix to a new chapter's emotion balance. */
  public updateEmotions(emotions: ChapterEmotions, fadeDuration = 3.0): void {
    if (!this.audioCtx || !this.isPlaying) return;
    const now = this.audioCtx.currentTime;

    for (const [key, target] of Object.entries(stemWeights(emotions))) {
      const stem = this.stems.get(key as StemKey);
      if (!stem) continue;
      const gain = stem.gainNode.gain;
      gain.cancelScheduledValues(now);
      // Anchor at where the fade actually is right now. Without this the ramp
      // starts from the last scheduled event instead, so interrupting a fade
      // jumps the volume.
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(
        target * stem.trim,
        now + Math.max(0.01, fadeDuration),
      );
    }
  }

  public stop(): void {
    if (!this.isPlaying || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.isPlaying = false;

    // Fade out rather than cutting, then let the scheduled passes run dry.
    for (const stem of this.stems.values()) {
      const gain = stem.gainNode.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + 0.4);
      stem.nextStart = 0;
    }
  }

  /** Release the AudioContext. Call when the player leaves the page. */
  public async dispose(): Promise<void> {
    this.stop();
    this.stems.clear();
    this.isLoaded = false;
    this.archetype = null;
    await this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.voiceDuckFilter = null;
  }

  /**
   * What each stem is playing at right now, mid-fade included, so the meters
   * show the real mix rather than the value it is heading for.
   */
  public getStemLevels(): Record<StemKey, number> {
    return Object.fromEntries(
      STEM_KEYS.map((key) => {
        const stem = this.stems.get(key);
        if (!stem) return [key, 0];
        // Report the mix weight, not the raw gain: the loudness trim is a
        // property of the recording, not something the reader chose.
        return [key, Math.min(1, stem.gainNode.gain.value / stem.trim)];
      }),
    ) as Record<StemKey, number>;
  }

  public getStatus(): {
    isLoaded: boolean;
    isPlaying: boolean;
    archetype: SoundArchetype | null;
    /** False when the browser is holding the context suspended. */
    audible: boolean;
  } {
    return {
      isLoaded: this.isLoaded,
      isPlaying: this.isPlaying,
      archetype: this.archetype,
      audible: isRunning(this.audioCtx),
    };
  }
}
