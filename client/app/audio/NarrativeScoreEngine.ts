import {
  STEM_KEYS,
  VOICE_PITCHES,
  seededRandom,
  voiceParams,
  type StemKey,
  type VoiceParams,
} from "@/app/audio/score";
import type { ChapterEmotions } from "@/workers/bookML.types";

/**
 * A soundtrack generated from a section's emotion scores, with no audio files.
 *
 * Four voices play at once, each owning its own pitches (see score.ts), so the
 * balance between them changes the harmony and not merely the volume. Neutral
 * and tension are continuous drones; joy and sadness play notes, scheduled ahead
 * of time against the audio clock.
 *
 * The interface matches StemAudioEngine, so either can drive the player.
 */

/** Evens out the voices, which are built from different waveforms and registers. */
const VOICE_TRIM: Record<StemKey, number> = {
  neutral: 0.22,
  // Plucks are transient, so they need more gain than a drone to read as equal.
  joy: 0.34,
  sadness: 0.3,
  tension: 0.26,
};

/** How far ahead of the clock notes are scheduled, and how often we top up. */
const LOOKAHEAD = 0.1;
const TICK_MS = 25;

type Voice = { gain: GainNode; filter: BiquadFilterNode };

/** A note rate mid-crossfade, so an arpeggio speeds up gradually. */
type RateRamp = { from: number; to: number; start: number; end: number };

export class NarrativeScoreEngine {
  private audioCtx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private voices = new Map<StemKey, Voice>();
  private drones: OscillatorNode[] = [];
  private droneMixes: GainNode[] = [];
  private lfo: OscillatorNode | null = null;
  private lfoDepth: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  private params: Record<StemKey, VoiceParams> | null = null;
  private rates = new Map<StemKey, RateRamp>();
  private nextNote: Record<"joy" | "sadness", number> = { joy: 0, sadness: 0 };
  private random: () => number = seededRandom(1);

  private isLoaded = false;
  private isPlaying = false;

  /**
   * Builds the audio graph. Nothing is fetched, but this stays async so it can
   * be called the same way as the sample-based engine — and so the
   * AudioContext is still created inside the user's click.
   */
  public async init(): Promise<void> {
    if (this.isLoaded) return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioContextClass();
    this.audioCtx = ctx;

    // Notches 2kHz to leave headroom for audiobook narration.
    const duck = ctx.createBiquadFilter();
    duck.type = "peaking";
    duck.frequency.value = 2000;
    duck.Q.value = 1.0;
    duck.gain.value = -4.0;
    duck.connect(ctx.destination);

    const bus = ctx.createGain();
    bus.gain.value = 0.5;
    bus.connect(duck);
    this.bus = bus;

    // A reverb tail built from decaying noise, so the space costs no asset.
    const convolver = ctx.createConvolver();
    convolver.buffer = this.buildImpulse(ctx, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    bus.connect(convolver);
    convolver.connect(wet);
    wet.connect(duck);

    for (const key of STEM_KEYS) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = key === "tension" ? 6 : 1;
      filter.frequency.value = 400;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      filter.connect(gain);
      gain.connect(bus);
      this.voices.set(key, { gain, filter });
    }

    this.isLoaded = true;
  }

  /** Noise with an exponential decay — a serviceable room without a recording. */
  private buildImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
      }
    }
    return impulse;
  }

  public start(initialEmotions?: ChapterEmotions): void {
    if (!this.audioCtx || !this.isLoaded || this.isPlaying) return;
    const ctx = this.audioCtx;

    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;

    // Every voice fades up from silence rather than punching in.
    for (const key of STEM_KEYS) {
      const voice = this.voices.get(key)!;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
    }

    this.startDrones(ctx, now);

    this.nextNote = { joy: now + 0.2, sadness: now + 0.6 };
    this.isPlaying = true;
    this.timer = setInterval(() => this.schedule(), TICK_MS);

    if (initialEmotions) this.updateEmotions(initialEmotions, 1.2);
  }

  /** Neutral and tension hold their pitches continuously; only their filters move. */
  private startDrones(ctx: AudioContext, at: number): void {
    const droneKeys: StemKey[] = ["neutral", "tension"];

    for (const key of droneKeys) {
      const voice = this.voices.get(key)!;
      const spread = key === "tension" ? 22 : 5;
      const count = VOICE_PITCHES[key].length * 2;

      // Oscillators sum, so a six-note cluster would otherwise arrive six times
      // louder than a single plucked note and bury every other voice.
      const mix = ctx.createGain();
      mix.gain.value = 1 / count;
      mix.connect(voice.filter);
      this.droneMixes.push(mix);

      for (const freq of VOICE_PITCHES[key]) {
        for (const direction of [-1, 1]) {
          const osc = ctx.createOscillator();
          osc.type = "sawtooth";
          osc.frequency.value = freq;
          osc.detune.value = direction * spread;
          osc.connect(mix);
          osc.start(at);
          this.drones.push(osc);
        }
      }
    }

    // Tension breathes: an LFO opens and closes its filter.
    const tension = this.voices.get("tension")!;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 3;
    const depth = ctx.createGain();
    depth.gain.value = 120;
    lfo.connect(depth);
    depth.connect(tension.filter.frequency);
    lfo.start(at);
    this.lfo = lfo;
    this.lfoDepth = depth;
  }

  /**
   * Tops up the note queue a fraction of a second ahead of the clock, so timing
   * comes from the audio hardware rather than from setInterval's drift.
   */
  private schedule(): void {
    const ctx = this.audioCtx;
    if (!ctx || !this.isPlaying || !this.params) return;

    const horizon = ctx.currentTime + LOOKAHEAD;

    for (const key of ["joy", "sadness"] as const) {
      const rate = this.rateAt(key, ctx.currentTime);
      if (rate <= 0) continue;

      // Guard against a runaway loop if the clock jumps.
      let budget = 16;
      while (this.nextNote[key] < horizon && budget > 0) {
        const at = Math.max(this.nextNote[key], ctx.currentTime);
        if (key === "joy") this.pluck(ctx, at);
        else this.swell(ctx, at);

        // A little jitter keeps the pulse from sounding mechanical.
        this.nextNote[key] = at + (1 / rate) * (0.82 + this.random() * 0.36);
        budget -= 1;
      }
    }
  }

  /** Where a note rate has reached, part way through a crossfade. */
  private rateAt(key: StemKey, now: number): number {
    const ramp = this.rates.get(key);
    if (!ramp) return 0;
    if (now >= ramp.end) return ramp.to;
    const progress = (now - ramp.start) / Math.max(1e-6, ramp.end - ramp.start);
    return ramp.from + (ramp.to - ramp.from) * Math.min(1, Math.max(0, progress));
  }

  /** A short bell-like note from the joy pentatonic. */
  private pluck(ctx: AudioContext, at: number): void {
    const voice = this.voices.get("joy")!;
    const pitches = VOICE_PITCHES.joy;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = pitches[Math.floor(this.random() * pitches.length)];
    osc.detune.value = (this.random() * 2 - 1) * (this.params?.joy.detune ?? 2);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.5, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0008, at + 0.9);

    osc.connect(env);
    env.connect(voice.filter);
    osc.start(at);
    osc.stop(at + 0.95);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }

  /** A slow pad from the minor set, two oscillators beating against each other. */
  private swell(ctx: AudioContext, at: number): void {
    const voice = this.voices.get("sadness")!;
    const pitches = VOICE_PITCHES.sadness;
    const freq = pitches[Math.floor(this.random() * pitches.length)];
    const detune = this.params?.sadness.detune ?? 6;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.45, at + 2.0);
    env.gain.setValueAtTime(0.45, at + 3.2);
    env.gain.exponentialRampToValueAtTime(0.0008, at + 7.0);
    env.connect(voice.filter);

    for (const direction of [-1, 1]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = direction * detune;
      osc.connect(env);
      osc.start(at);
      osc.stop(at + 7.2);
      osc.onended = () => osc.disconnect();
    }

    setTimeout(
      () => env.disconnect(),
      Math.max(0, (at + 7.4 - ctx.currentTime) * 1000),
    );
  }

  /**
   * Moves the score to a new section: levels, filters and note rates all travel
   * over the same crossfade.
   */
  public updateEmotions(emotions: ChapterEmotions, fadeDuration = 3.0): void {
    if (!this.audioCtx || !this.isPlaying) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const params = voiceParams(emotions);
    this.params = params;

    // Seeded per section, so a chapter always renders the same music.
    this.random = seededRandom(emotions.chapterIndex * 9973 + 17);

    for (const key of STEM_KEYS) {
      const voice = this.voices.get(key)!;
      this.ramp(voice.gain.gain, params[key].level * VOICE_TRIM[key], fadeDuration);
      this.ramp(voice.filter.frequency, params[key].cutoff, fadeDuration);

      this.rates.set(key, {
        from: this.rateAt(key, now),
        to: params[key].rate,
        start: now,
        end: now + fadeDuration,
      });
    }

    if (this.lfo) this.ramp(this.lfo.frequency, params.tension.rate, fadeDuration);
    if (this.lfoDepth) {
      this.ramp(this.lfoDepth.gain, params.tension.cutoff * 0.6, fadeDuration);
    }
  }

  /**
   * Anchors the parameter at where it actually is before ramping. Without this
   * the ramp starts from the last scheduled event instead, so interrupting a
   * crossfade jumps.
   */
  private ramp(param: AudioParam, target: number, seconds: number): void {
    const now = this.audioCtx!.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + Math.max(0.01, seconds));
  }

  public stop(): void {
    if (!this.isPlaying || !this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.isPlaying = false;

    for (const key of STEM_KEYS) {
      const voice = this.voices.get(key)!;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + 0.4);
    }

    // Let the fade finish before the oscillators go, so stopping doesn't click.
    for (const osc of this.drones) {
      try {
        osc.stop(now + 0.45);
      } catch {
        // Already stopped.
      }
    }
    this.drones = [];

    const mixes = this.droneMixes;
    this.droneMixes = [];
    setTimeout(() => mixes.forEach((m) => m.disconnect()), 600);

    try {
      this.lfo?.stop(now + 0.45);
    } catch {
      // Already stopped.
    }
    this.lfo = null;
    this.lfoDepth = null;
  }

  /** Release the AudioContext. Call when the player leaves the page. */
  public async dispose(): Promise<void> {
    this.stop();
    this.voices.clear();
    this.isLoaded = false;
    await this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.bus = null;
  }

  /**
   * What each voice is playing at right now, mid-crossfade included, on the same
   * 0-to-1 scale as voiceLevels so the meters read as the mix.
   */
  public getStemLevels(): Record<StemKey, number> {
    return Object.fromEntries(
      STEM_KEYS.map((key) => {
        const gain = this.voices.get(key)?.gain.gain.value ?? 0;
        return [key, Math.min(1, gain / VOICE_TRIM[key])];
      }),
    ) as Record<StemKey, number>;
  }

  public getStatus(): { isLoaded: boolean; isPlaying: boolean } {
    return { isLoaded: this.isLoaded, isPlaying: this.isPlaying };
  }
}
