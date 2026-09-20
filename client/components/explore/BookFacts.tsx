"use client";

import { Award } from "lucide-react";
import type { BookMetadata } from "@/lib/bookMetadata";

/**
 * Everything under a book's author line: the publishing facts, a New York Times
 * bestseller badge for anything currently charting, and the book's description.
 *
 * The description comes from Google Books, which is the only source here that
 * has one. `fallbackSummary` — the copy held in lib/books.ts — shows until the
 * lookup lands, and stays if the lookup has nothing better to offer, so the
 * paragraph never blinks out.
 *
 * The lookup itself belongs to BookExperience: the soundtrack needs the same
 * response for its archetype, and the page should only ask for it once.
 */

/** Below this, a "description" is a stub like "A novel." and not worth showing. */
const MIN_USEFUL_DESCRIPTION = 120;

/** Google's blurbs run long and wander; a few sentences is the useful part. */
const MAX_DESCRIPTION = 320;

function toBlurb(text: string): string {
  if (text.length <= MAX_DESCRIPTION) return text;
  const cut = text.slice(0, MAX_DESCRIPTION);
  // Prefer ending on a sentence; fall back to a word so it never breaks mid-word.
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (sentenceEnd > MAX_DESCRIPTION * 0.5) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}...`;
}

export default function BookFacts({
  data,
  fallbackSummary,
}: {
  /** Null until the lookup lands, or if it failed. */
  data: BookMetadata | null;
  fallbackSummary: string;
}) {
  const details = data?.details;
  const nyt = data?.nyt;
  // A response cached by the browser before this shape existed still arrives
  // here, so never assume a field is present.
  const sources = details?.sources ?? [];

  const description =
    details && details.description.length >= MIN_USEFUL_DESCRIPTION
      ? toBlurb(details.description)
      : fallbackSummary;

  const facts = [
    details?.firstPublishYear ? String(details.firstPublishYear) : null,
    details?.publisher || null,
    details?.pageCount ? `${details.pageCount} pages` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mt-2 space-y-1.5">
      {facts.length > 0 && (
        <p className="text-xs text-stone-500">
          {facts.join(" · ")}
          {sources.length > 0 && (
            <span className="text-stone-400">
              {" "}
              · via{" "}
              {sources
                .map((s) => (s === "google" ? "Google Books" : "Open Library"))
                .join(" and ")}
            </span>
          )}
        </p>
      )}

      {nyt && (
        <p className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-[#C9A227]/12 px-2.5 py-1 text-xs text-[#8B5E34]">
          <Award className="h-3.5 w-3.5 flex-none" />
          <span className="font-medium">New York Times bestseller</span>
          <span className="text-[#8B5E34]/75">
            #{nyt.rank} · {nyt.listName} · {nyt.weeksOnList}{" "}
            {nyt.weeksOnList === 1 ? "week" : "weeks"}
          </span>
        </p>
      )}

      <p className="pt-2 text-[15px] leading-relaxed text-stone-700 lg:line-clamp-6">
        {description}
      </p>
    </div>
  );
}
