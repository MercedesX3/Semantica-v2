"use client";

import { useEffect, useState } from "react";
import BookFacts from "@/components/explore/BookFacts";
import BookSentiment from "@/components/explore/BookSentiment";
import BookSoundtrack from "@/components/explore/BookSoundtrack";
import { useStoredAnalysis } from "@/hooks/useStoredAnalysis";
import { fetchBookMetadata, type BookMetadata } from "@/lib/bookMetadata";
import type { ShelfBook } from "@/lib/books";

/**
 * A book's page: cover and facts on the left, the emotional arc and its
 * soundtrack on the right.
 *
 * Both halves share one analysis and one selected section, so picking a section
 * on the arc crossfades the soundtrack to it and the other way round. The
 * metadata lookup is made here too rather than in BookFacts, because the
 * soundtrack needs the same response to know which archetype to play.
 */
export default function BookExperience({ book }: { book: ShelfBook }) {
  const { state } = useStoredAnalysis(book.bookId);
  const [active, setActive] = useState(0);
  const [metadata, setMetadata] = useState<BookMetadata | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchBookMetadata(book.title, book.author, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setMetadata(result);
      })
      .catch(() => {
        // Missing metadata costs a blurb and the stems, not the page.
      });

    return () => controller.abort();
  }, [book.title, book.author]);

  const rows = state.status === "complete" ? state.results : [];
  // A shorter book can leave the selection past the end; fall back to the first.
  const selected = active < rows.length ? active : 0;

  return (
    <div className="grid w-full flex-1 gap-8 lg:min-h-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-12">
      {/* Left: cover, then the title, facts and summary */}
      <section className="flex min-h-0 flex-col gap-5">
        <div
          className="aspect-[2/3] w-44 flex-none overflow-hidden rounded-lg bg-cover bg-center shadow-[0px_12px_30px_0px_rgba(0,0,0,0.25)] sm:w-52 lg:h-[min(32vh,26rem)] lg:w-auto lg:self-start"
          style={{
            backgroundImage: book.cover
              ? `url(${book.cover})`
              : "linear-gradient(135deg, #3b2f63, #171329)",
          }}
          role="img"
          aria-label={`Cover of ${book.title}`}
        />
        <div className="min-h-0 overflow-hidden">
          <h1 style={{ fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1.15 }}>
            {book.title}
          </h1>
          <p className="mt-1 text-stone-500">{book.author}</p>
          <BookFacts data={metadata} fallbackSummary={book.summary} />
        </div>
      </section>

      {/* Right: the arc, with the player that follows it directly underneath. */}
      <section className="min-h-0">
        <BookSentiment
          state={state}
          active={selected}
          onSelect={setActive}
          footer={
            rows.length > 0 ? (
              <BookSoundtrack
                rows={rows}
                active={selected}
                onSelect={setActive}
                // The shelf's own judgement wins: the lookup reads era before
                // genre, so every classic here would otherwise be "historical".
                archetype={book.soundArchetype ?? metadata?.soundArchetype ?? null}
              />
            ) : null
          }
        />
      </section>
    </div>
  );
}
