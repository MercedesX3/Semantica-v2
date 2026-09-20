import { NextResponse } from "next/server";
import { fetchDetails } from "@/app/api/book-metadata/providers";
import {
  normalizeTitle,
  resolveSoundArchetype,
  type BookMetadata,
  type NytBook,
} from "@/lib/bookMetadata";

const OVERVIEW_URL = "https://api.nytimes.com/svc/books/v3/lists/overview.json";
const CACHE_SECONDS = 60 * 60 * 24;

type RawBook = {
  title?: string;
  author?: string;
  publisher?: string;
  description?: string;
  primary_isbn13?: string;
  book_image?: string;
  book_review_link?: string;
  rank?: number;
  rank_last_week?: number;
  weeks_on_list?: number;
};

type RawOverview = {
  results?: { lists?: { list_name?: string; books?: RawBook[] }[] };
  fault?: { faultstring?: string };
  errors?: string[];
};

type Indexed = { book: RawBook; listName: string };

/** Every book on a current list, keyed by a loosely-normalized title. */
async function currentBestsellers(): Promise<
  | { ok: true; index: Map<string, Indexed[]> }
  | { ok: false; error: string; status: number }
> {
  const key = process.env.NEW_YORK_TIMES_API_KEY;
  if (!key) {
    return {
      ok: false,
      status: 500,
      error:
        "NEW_YORK_TIMES_API_KEY is not set. Add it to client/.env and restart the dev server.",
    };
  }

  const res = await fetch(
    `${OVERVIEW_URL}?api-key=${encodeURIComponent(key)}`,
    {
      next: { revalidate: CACHE_SECONDS },
    },
  );

  // The NYT answers with plain text on some errors, so don't assume JSON.
  const raw = await res.text();
  let body: RawOverview | null = null;
  try {
    body = JSON.parse(raw) as RawOverview;
  } catch {
    body = null;
  }

  if (res.status === 429) {
    return {
      ok: false,
      status: 429,
      error:
        "The New York Times rate limit was hit (5 requests a minute, 500 a day). Try again shortly.",
    };
  }
  if (!res.ok) {
    const detail =
      body?.fault?.faultstring ?? body?.errors?.join(", ") ?? raw.slice(0, 120);
    return {
      ok: false,
      status: res.status,
      error: `New York Times request failed (${res.status}): ${detail}`,
    };
  }

  const index = new Map<string, Indexed[]>();
  for (const list of body?.results?.lists ?? []) {
    for (const book of list.books ?? []) {
      if (!book.title) continue;
      const slot = normalizeTitle(book.title);
      const entry = { book, listName: list.list_name ?? "" };
      index.set(slot, [...(index.get(slot) ?? []), entry]);
    }
  }

  return { ok: true, index };
}

/** Surname is enough — the NYT and our own records disagree on initials. */
function authorMatches(candidate: string, wanted: string): boolean {
  if (!wanted || wanted.toLowerCase() === "unknown") return true;
  const surname = wanted.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  return surname.length > 2 && candidate.toLowerCase().includes(surname);
}

const toNytBook = ({ book, listName }: Indexed): NytBook => ({
  listName,
  rank: book.rank ?? 0,
  rankLastWeek: book.rank_last_week ?? 0,
  weeksOnList: book.weeks_on_list ?? 0,
  publisher: book.publisher ?? "",
  description: book.description ?? "",
  isbn13: book.primary_isbn13 ?? "",
  coverUrl: book.book_image ?? "",
  reviewUrl: book.book_review_link ?? "",
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim();
  const author = searchParams.get("author")?.trim() ?? "";

  if (!title) {
    return NextResponse.json(
      { error: "A title is required." },
      { status: 400 },
    );
  }

  // Independent sources, so run them together and let either one come back empty.
  const [lookup, details] = await Promise.all([
    currentBestsellers(),
    fetchDetails(title, author),
  ]);

  // A dead NYT lookup shouldn't sink the details we did get.
  const candidates = lookup.ok
    ? (lookup.index.get(normalizeTitle(title)) ?? [])
    : [];
  const match =
    candidates.find((c) => authorMatches(c.book.author ?? "", author)) ?? null;

  const nyt = match ? toNytBook(match) : null;
  const found = nyt !== null || details !== null;

  const metadata: BookMetadata = {
    title,
    author,
    found,
    nyt,
    details,
    // Only meaningful once a source has told us something about the book;
    // with nothing to go on it would just be the default archetype.
    soundArchetype: found ? resolveSoundArchetype(title, nyt, details) : null,
    ...(lookup.ok ? {} : { error: lookup.error }),
  };

  return NextResponse.json(metadata, {
    headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
  });
}
