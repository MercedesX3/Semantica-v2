import { STEM_KEYS, stemWeights, type StemKey } from "@/app/audio/score";
import type { ChapterEmotions } from "@/workers/bookML.types";

/*
 * The sample-based mixer: four looping stems crossfaded by emotion.
 *
 * Unused while NarrativeScoreEngine generates the score instead. Kept for when
 * real music stems exist — the files currently in public/audio are placeholder
 * sine tones, one steady pitch each.
 */

export class StemAudioEngine {
  private audioCtx: AudioContext | null = null;
  private stems: Map<
    string,
    { buffer: AudioBuffer; gainNode: GainNode; source?: AudioBufferSourceNode }
  > = new Map();
  private voiceDuckFilter: BiquadFilterNode | null = null;
  private isLoaded = false;
  private isPlaying = false;

  private stemUrls: Record<string, string> = {
    neutral: "/audio/stem_neutral.wav",
    joy: "/audio/stem_joy.wav",
    sadness: "/audio/stem_sadness.wav",
    tension: "/audio/stem_tension.wav",
  };

  /**
   * Initializes the AudioContext on user interaction and decodes the audio assets.
   */
  public async init(): Promise<void> {
    if (this.isLoaded) return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.audioCtx = new AudioContextClass();

    // Voice ducking filter: notches 2kHz to leave headroom for audiobook narration
    this.voiceDuckFilter = this.audioCtx.createBiquadFilter();
    this.voiceDuckFilter.type = "peaking";
    this.voiceDuckFilter.frequency.value = 2000;
    this.voiceDuckFilter.Q.value = 1.0;
    this.voiceDuckFilter.gain.value = -4.0;
    this.voiceDuckFilter.connect(this.audioCtx.destination);

    // Fetch and decode all stems concurrently into memory
    const loadPromises = Object.entries(this.stemUrls).map(
      async ([key, url]) => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await this.audioCtx!.decodeAudioData(arrayBuffer);

        const gainNode = this.audioCtx!.createGain();
        gainNode.gain.setValueAtTime(0, this.audioCtx!.currentTime);
        gainNode.connect(this.voiceDuckFilter!);

        this.stems.set(key, { buffer: decodedBuffer, gainNode });
      },
    );

    await Promise.all(loadPromises);
    this.isLoaded = true;
  }

  /**
   * Starts all 4 stems locked to the exact same audio timeline clock.
   */
  public start(initialEmotions?: ChapterEmotions): void {
    if (!this.audioCtx || !this.isLoaded || this.isPlaying) return;

    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    const startTime = this.audioCtx.currentTime + 0.05;

    this.stems.forEach((stem) => {
      const source = this.audioCtx!.createBufferSource();
      source.buffer = stem.buffer;
      source.loop = true;
      source.connect(stem.gainNode);
      source.start(startTime);
      stem.source = source;
    });

    this.isPlaying = true;

    if (initialEmotions) {
      this.updateEmotions(initialEmotions, 1.0);
    }
  }

  /**
   * Smoothly transitions the stem volumes to mirror new chapter emotion scores.
   */
  public updateEmotions(emotions: ChapterEmotions, fadeDuration = 3.0): void {
    if (!this.audioCtx || !this.isPlaying) return;
    const now = this.audioCtx.currentTime;

    for (const [key, target] of Object.entries(stemWeights(emotions))) {
      const stem = this.stems.get(key);
      if (stem) {
        const gain = stem.gainNode.gain;
        gain.cancelScheduledValues(now);
        // Anchor at where the fade actually is right now. Without this the ramp
        // starts from the last scheduled event instead, so interrupting a fade
        // jumps the volume.
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(target, now + fadeDuration);
      }
    }
  }

  public stop(): void {
    if (!this.isPlaying) return;

    const now = this.audioCtx?.currentTime ?? 0;

    this.stems.forEach((stem) => {
      try {
        stem.source?.stop();
        stem.source?.disconnect();
        stem.source = undefined;
        // Silence the stem so the next start() fades up from nothing rather
        // than punching in at the volume it was stopped at.
        stem.gainNode.gain.cancelScheduledValues(now);
        stem.gainNode.gain.setValueAtTime(0, now);
      } catch {
        // Source already stopped
      }
    });

    this.isPlaying = false;
  }

  /** Release the AudioContext. Call when the player leaves the page. */
  public async dispose(): Promise<void> {
    this.stop();
    this.stems.clear();
    this.isLoaded = false;
    await this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.voiceDuckFilter = null;
  }

  /**
   * What each stem is playing at right now, mid-fade included, for meters that
   * show the real mix rather than the value it's heading for.
   */
  public getStemLevels(): Record<StemKey, number> {
    return Object.fromEntries(
      STEM_KEYS.map((key) => [key, this.stems.get(key)?.gainNode.gain.value ?? 0]),
    ) as Record<StemKey, number>;
  }

  public getStatus(): { isLoaded: boolean; isPlaying: boolean } {
    return { isLoaded: this.isLoaded, isPlaying: this.isPlaying };
  }
}
