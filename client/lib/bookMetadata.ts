/**
 * Metadata about a book, for the shelf and for uploads.
 *
 * Two sources, because neither covers the whole shelf on its own:
 *
 * - The New York Times knows only what is on a bestseller list right now
 *   (~180 titles), so it answers for a charting upload and for nothing else.
 *   Its per-title endpoints were retired; see the route for what survives.
 * - Google Books and Open Library together supply the ordinary facts, including
 *   for classics the NYT has never listed. Neither is right on its own: Google
 *   dates the edition it happens to match (it puts Frankenstein in 2021), while
 *   Open Library's search index carries no description. See providers.ts.
 */

export type SoundArchetype =
  | "historical"
  | "scifi"
  | "contemporary"
  | "thriller";

export type NytBook = {
  /** The bestseller list it appears on, e.g. "Hardcover Fiction". */
  listName: string;
  rank: number;
  rankLastWeek: number;
  weeksOnList: number;
  publisher: string;
  description: string;
  isbn13: string;
  coverUrl: string;
  /** The NYT's own review, when they have written one. */
  reviewUrl: string;
};

export type DetailsSource = "google" | "openlibrary";

export type BookDetails = {
  /** Which providers contributed, for attribution on the page. */
  sources: DetailsSource[];
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  publisher: string;
  description: string;
  pageCount: number | null;
  coverUrl: string;
  subjects: string[];
};

export type BookMetadata = {
  title: string;
  author: string;
  /** The kind of score this book should get; null when nothing is known. */
  soundArchetype: SoundArchetype | null;
  /** True when either source had something. */
  found: boolean;
  nyt: NytBook | null;
  details: BookDetails | null;
  /** Set when a lookup failed, so callers can tell it from "no data". */
  error?: string;
};

export const emptyMetadata = (title: string, author: string): BookMetadata => ({
  title,
  author,
  found: false,
  nyt: null,
  details: null,
  soundArchetype: null,
});

/**
 * Titles are compared loosely: the NYT writes them in capitals, and a leading
 * article shouldn't decide whether two books are the same.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Anything first published before this reads as period rather than present-day.
 * Late enough to catch the modernist classics (Gatsby, Metamorphosis) and early
 * enough to leave post-war fiction as contemporary.
 */
const HISTORICAL_BEFORE_YEAR = 1960;

/**
 * Which of the four scores a book should get, decided from whatever metadata
 * the lookup returned.
 *
 * Takes BookDetails as it actually is rather than a hand-shaped copy, so the
 * field names cannot drift apart from the source they come from.
 */
export function resolveSoundArchetype(
  title: string,
  nyt: NytBook | null,
  details: BookDetails | null,
): SoundArchetype {
  // Every text signal we have, searched as one string.
  const corpus = [
    title,
    nyt?.listName ?? "",
    nyt?.description ?? "",
    details?.description ?? "",
    (details?.subjects ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  // A missing year must not imply an old book. `firstPublishYear` is already a
  // number, so there is no date string to parse and nothing to return undefined.
  const year = details?.firstPublishYear ?? null;
  const predatesModernEra = year !== null && year < HISTORICAL_BEFORE_YEAR;

  // 1. Era wins over genre. Library metadata files Kafka under "Fantasy
  // fiction" and Google calls Frankenstein science fiction; both are fair
  // descriptions and both are the wrong score for a book of their age. A known
  // publication date is the strongest signal available, so it is read first.
  if (predatesModernEra) {
    return "historical";
  }

  // 2. Sci-Fi & Fantasy
  if (
    /\b(sci-fi|science fiction|space|cyberpunk|dystopian|alien|galaxy|futuristic|magic|fantasy|starship|interstellar)\b/.test(
      corpus,
    )
  ) {
    return "scifi";
  }

  // 3. Thriller, Mystery & Horror
  if (
    /\b(thriller|mystery|murder|crime|detective|horror|suspense|killer|psychological thriller|espionage|noir)\b/.test(
      corpus,
    )
  ) {
    return "thriller";
  }

  // 4. Period feel claimed by the text itself, with no date to confirm it.
  if (
    /\b(historical|victorian|regency|century|war|classic|classics|period|kingdom|empire|medieval|gothic|antiquity)\b/.test(
      corpus,
    )
  ) {
    return "historical";
  }

  // 5. Default fallback: Contemporary Fiction / Non-Fiction / Memoir
  return "contemporary";
}

/** Calls our own route, which holds the API keys server-side. */
export async function fetchBookMetadata(
  title: string,
  author?: string,
  signal?: AbortSignal,
): Promise<BookMetadata> {
  const params = new URLSearchParams({ title });
  if (author && author !== "Unknown") params.set("author", author);

  // Revalidate rather than reuse blindly: the real caching happens server-side
  // on the upstream calls, and an earlier build of this route told browsers to
  // hold its answer for a day — those stale copies would otherwise outlive any
  // fix to the data for another 24 hours.
  const res = await fetch(`/api/book-metadata?${params}`, {
    signal,
    cache: "no-cache",
  });
  const body = await res.json();

  if (!res.ok) {
    return {
      ...emptyMetadata(title, author ?? ""),
      error: body.error ?? `Lookup failed (${res.status})`,
    };
  }
  return body as BookMetadata;
}
