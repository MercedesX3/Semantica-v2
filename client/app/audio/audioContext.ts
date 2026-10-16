/**
 * Creating and unlocking an AudioContext on a phone.
 *
 * Both engines go through here because mobile Safari has two rules that desktop
 * browsers do not enforce, and either one of them produces silence with no
 * error at all.
 */

type MaybeWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/** iOS 16.4+ lets a page say it is playing media rather than making a sound. */
type AudioSessionWindow = Navigator & {
  audioSession?: { type: string };
};

/**
 * Builds a context and starts it, in that order and without yielding in
 * between.
 *
 * iOS only honours `resume()` while the user's tap is still being handled. Any
 * await before it — fetching stems, decoding them — outlives the gesture, the
 * resume is quietly ignored and the context stays suspended forever. So the
 * context is started here, at the top of the click, and the slow work happens
 * afterwards against a context that is already running.
 */
export async function createRunningContext(): Promise<AudioContext> {
  const AudioContextClass =
    window.AudioContext || (globalThis as MaybeWebkit).webkitAudioContext!;
  const ctx = new AudioContextClass();

  // Without this the ring/silent switch mutes Web Audio on an iPhone, which
  // looks exactly like a broken player to anyone whose phone is on silent.
  const nav = navigator as AudioSessionWindow;
  if (nav.audioSession) {
    try {
      nav.audioSession.type = "playback";
    } catch {
      // Older iOS exposes the object without allowing the assignment.
    }
  }

  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => {
      // Reported by the caller via `ctx.state`, not thrown: a suspended
      // context is still usable once the reader taps again.
    });
  }

  return ctx;
}

/** True when the context will actually make sound. */
export const isRunning = (ctx: AudioContext | null) => ctx?.state === "running";
