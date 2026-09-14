import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  BookOpen,
  Compass,
  Library,
  LineChart,
  Lock,
  Music,
  ScanText,
  Sparkles,
  Upload,
} from "lucide-react";
import ButterflyBackground from "@/components/butterflies/ButterflyBackground";
import EmotionArc from "@/components/home/EmotionArc";
import { CARD, FRAME } from "@/components/PageShell";

/*
 * Note on type: globals.css styles bare h1, h2 and p, and those unlayered rules
 * outrank Tailwind's layered utilities. So heading size and colour overrides
 * below go through `style`, and serif display text that isn't a heading uses a
 * <div> or <h3> with `font-serif`.
 */

const primaryButton =
  "inline-flex items-center gap-2 rounded-[40px] font-[family-name:var(--font-inter)] bg-linear-80 from-stone-500 to-yellow-800 whitespace-nowrap px-6 py-2.5 text-lg font-semibold text-stone-50 sm:px-8 sm:text-xl shadow-[0px_4px_4px_0px_rgba(142,142,142,0.25)] outline-2 -outline-offset-2 outline-stone-400 transition-all duration-300 ease-out hover:drop-shadow-2xl";

const secondaryButton =
  "inline-flex items-center gap-2 rounded-[40px] font-[family-name:var(--font-inter)] bg-white whitespace-nowrap px-6 py-2.5 text-lg font-semibold text-stone-500 sm:px-8 sm:text-xl shadow-[0px_4px_4px_0px_rgba(142,142,142,0.25)] outline-4 -outline-offset-4 outline-stone-400 transition-all duration-300 ease-out hover:drop-shadow-2xl";

const eyebrow =
  "text-xs font-semibold uppercase tracking-[0.22em] text-[#4D8937]";

const STEPS = [
  {
    icon: ScanText,
    title: "Split into chapters",
    body: "The book is broken into its chapters, so every part of the story is read on its own terms.",
  },
  {
    icon: Sparkles,
    title: "Read the emotion",
    body: "Each chapter is scored for the emotions running through it: joy, sadness, fear, anger and more.",
  },
  {
    icon: LineChart,
    title: "Chart the arc",
    body: "Those scores are plotted chapter by chapter, showing how the feeling of the book rises, falls and turns.",
  },
  {
    icon: BookOpen,
    title: "Bring it to life",
    body: "The arc, together with a summary of the book, drives recommendations, a soundtrack and character voices.",
  },
];

const FEATURES = [
  {
    icon: Compass,
    title: "Books that fit your mood",
    body: "Tell Semantica how you feel or how you want to feel and it finds books whose emotional arcs match, not just the genre you usually reach for.",
  },
  {
    icon: Music,
    title: "A soundtrack to read by",
    body: "Music generated from the book's emotional shifts, meant to play alongside you as you read, chapter by chapter.",
  },
  {
    icon: AudioLines,
    title: "Characters with a voice",
    body: "Character analysis across the whole book gives each speaker a distinct voice, for audiobook-style clips of the story.",
  },
];

export default function Home() {
  return (
    <div className={`flex min-h-screen flex-1 flex-col font-sans ${FRAME}`}>
      <div className={`relative flex-1 overflow-hidden ${CARD}`}>
        {/* ── Hero ─────────────────────────────────────────────
            The butterflies fill this section only, and fly in the strip to
            the left of <main> (they measure it), so keep the two together. */}
        <section className="relative flex min-h-[calc(100svh-1.5rem)] sm:min-h-[calc(100svh-3rem)] lg:min-h-[calc(100svh-5rem)]">
          <ButterflyBackground />

          <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-start justify-center px-6 py-24">
            <h1
              style={{ fontSize: "clamp(38px, 11vw, 96px)", lineHeight: 1.05 }}
            >
              SEMANTICA
            </h1>
            <h2 className="mt-3" style={{ fontSize: "clamp(20px, 3vw, 28px)" }}>
              Find your next book by how it feels.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
              Semantica reads a book chapter by chapter, maps the emotions in
              each one, and charts how they change from the first page to the
              last. That emotional arc then recommends books for your mood,
              scores a soundtrack to read along with, and gives the characters a
              voice.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/explore" className={primaryButton}>
                EXPLORE BOOKS
              </Link>
              <Link href="/upload" className={secondaryButton}>
                UPLOAD PDF
              </Link>
            </div>

            <a
              href="#idea"
              className="mt-16 inline-flex items-center gap-2 text-sm font-medium text-stone-400 transition-colors hover:text-stone-700"
            >
              See how it works
              <ArrowDown className="h-4 w-4 animate-bounce" />
            </a>
          </main>
        </section>

        {/* ── The idea ─────────────────────────────────────────── */}
        <section
          id="idea"
          className="scroll-mt-10 border-t border-stone-100 px-6 py-24 sm:px-12"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className={eyebrow}>The idea</p>
              <h2
                className="mt-4"
                style={{
                  fontSize: "clamp(28px, 4vw, 44px)",
                  lineHeight: 1.15,
                  color: "#113E00",
                }}
              >
                Tropes tell you what happens. Emotion tells you how it feels.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-stone-600">
                Recommendations usually lean on genre and tropes — enemies to
                lovers, the chosen one, the locked-room mystery. But two books
                with the same tropes can feel completely different to read.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-stone-600">
                Semantica follows the feeling instead: where a story is warm,
                where it aches, where the dread builds and where it finally
                breaks. That shape is what we use to guide what you read next.
              </p>
            </div>

            <EmotionArc />
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="bg-stone-50/80 px-6 py-24 sm:px-12">
          <div className="mx-auto max-w-6xl">
            <p className={eyebrow}>How it works</p>
            <h2
              className="mt-4 max-w-2xl"
              style={{
                fontSize: "clamp(26px, 3.4vw, 38px)",
                lineHeight: 1.2,
                color: "#113E00",
              }}
            >
              From pages to a map of feeling
            </h2>

            <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li
                  key={title}
                  className="relative rounded-3xl border border-stone-200 bg-white p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#4D8937]/10">
                      <Icon className="h-5 w-5 text-[#4D8937]" />
                    </span>
                    <span className="font-serif text-3xl text-stone-200">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-5 font-serif text-lg text-[#113E00]">
                    {title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-stone-600">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── What the arc unlocks ─────────────────────────────── */}
        <section className="px-6 py-24 sm:px-12">
          <div className="mx-auto max-w-6xl">
            <p className={eyebrow}>What the arc unlocks</p>
            <h2
              className="mt-4 max-w-2xl"
              style={{
                fontSize: "clamp(26px, 3.4vw, 38px)",
                lineHeight: 1.2,
                color: "#113E00",
              }}
            >
              More than a recommendation
            </h2>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="group rounded-3xl border border-stone-200 p-6 sm:p-7 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0px_12px_32px_0px_rgba(142,142,142,0.25)]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-80 from-stone-500 to-yellow-800">
                    <Icon className="h-6 w-6 text-stone-50" />
                  </span>
                  <h3 className="mt-6 font-serif text-xl text-[#113E00]">
                    {title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-stone-600">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Two ways in ──────────────────────────────────────── */}
        <section className="bg-stone-50/80 px-6 py-24 sm:px-12">
          <div className="mx-auto max-w-6xl">
            <p className={eyebrow}>Two ways in</p>
            <h2
              className="mt-4 max-w-2xl"
              style={{
                fontSize: "clamp(26px, 3.4vw, 38px)",
                lineHeight: 1.2,
                color: "#113E00",
              }}
            >
              Start with a classic, or bring your own book
            </h2>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <article className="flex flex-col rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4D8937]/10">
                  <Library className="h-6 w-6 text-[#4D8937]" />
                </span>
                <h3 className="mt-6 font-serif text-2xl text-[#113E00]">
                  Explore Books
                </h3>
                <p className="mt-3 leading-relaxed text-stone-600">
                  Five classics, from Frankenstein to The Great Gatsby, already
                  analyzed. Walk through the full pipeline: each chapter&apos;s
                  emotions, the arc across the book, which title fits your mood,
                  and the soundtrack made to read it by.
                </p>
                <ul className="mt-5 space-y-2 text-stone-600">
                  {[
                    "Chapter-by-chapter emotion analysis",
                    "Mood-based matching across the collection",
                    "Soundtracks and character voice clips",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#4D8937]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 pt-2">
                  <Link href="/explore" className={primaryButton}>
                    EXPLORE BOOKS
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              </article>

              <article className="flex flex-col rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4D8937]/10">
                    <Upload className="h-6 w-6 text-[#4D8937]" />
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4D8937]/30 bg-[#4D8937]/5 px-3 py-1 text-xs font-semibold text-[#4D8937]">
                    <Lock className="h-3.5 w-3.5" />
                    Private by design
                  </span>
                </div>
                <h3 className="mt-6 font-serif text-2xl text-[#113E00]">
                  Upload PDF
                </h3>
                <p className="mt-3 leading-relaxed text-stone-600">
                  Bring any book you own. The emotion analysis runs entirely in
                  your browser — your PDF is never uploaded or shared with any
                  service, so your copy stays yours. The arc it produces, with a
                  summary of the book, then shapes a soundtrack and
                  recommendations.
                </p>
                <ul className="mt-5 space-y-2 text-stone-600">
                  {[
                    "Processed on your device, never on a server",
                    "Your book's own emotional arc",
                    "A soundtrack and picks built from it",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#4D8937]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 pt-2">
                  <Link href="/upload" className={secondaryButton}>
                    UPLOAD PDF
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ── Closing ──────────────────────────────────────────── */}
        <section className="px-6 py-24 text-center sm:px-12">
          <div className="mx-auto max-w-2xl">
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                lineHeight: 1.15,
                color: "#113E00",
              }}
            >
              Read by feeling.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
              See what a story feels like before you start it — and hear it
              while you read.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link href="/explore" className={primaryButton}>
                EXPLORE BOOKS
              </Link>
              <Link href="/upload" className={secondaryButton}>
                UPLOAD PDF
              </Link>
            </div>
            <p className="mt-16 text-sm text-stone-400">
              Demo books are texts from Project Gutenberg.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
