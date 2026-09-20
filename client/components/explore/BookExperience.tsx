"use client";

import { useState, type ReactNode } from "react";
import BookSentiment from "@/components/explore/BookSentiment";
import BookSoundtrack from "@/components/explore/BookSoundtrack";
import { useStoredAnalysis } from "@/hooks/useStoredAnalysis";

/**
 * The two columns of a book's page, sharing one analysis and one selected
 * section: pick a section on the arc and the soundtrack cross-fades to it, and
 * the other way around.
 *
 * `children` is the cover and summary, rendered on the server by the page.
 */
export default function BookExperience({
  bookId,
  children,
}: {
  bookId: string;
  children: ReactNode;
}) {
  const { state } = useStoredAnalysis(bookId);
  const [active, setActive] = useState(0);

  const rows = state.status === "complete" ? state.results : [];
  // A shorter book can leave the selection past the end; fall back to the first.
  const selected = active < rows.length ? active : 0;

  return (
    <div className="grid w-full flex-1 gap-8 lg:min-h-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-12">
      <section className="flex min-h-0 flex-col gap-5">{children}</section>

      {/* Right: the arc, with the player that follows it directly underneath. */}
      <section className="min-h-0">
        <BookSentiment
          state={state}
          active={selected}
          onSelect={setActive}
          footer={
            rows.length > 0 ? (
              <BookSoundtrack rows={rows} active={selected} onSelect={setActive} />
            ) : null
          }
        />
      </section>
    </div>
  );
}
