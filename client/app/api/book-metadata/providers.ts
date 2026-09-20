import type { BookDetails } from "@/lib/bookMetadata";

/**
 * The two providers of ordinary book facts, merged into one answer.
 *
 * Neither is usable alone. Google Books dates whichever *edition* its search
 * happens to match — it puts Frankenstein in 2021 and Pride and Prejudice in
 * 1918 — but it carries the only real description. Open Library knows the
 * work's true first publication year and has the better cover and subjects,
 * but its search index has no blurb at all.
 *
 * So each field comes from whichever source is authoritative for it. Google is
 * skipped entirely when GOOGLE_BOOKS_API_KEY is unset, since without a key its
 * shared anonymous quota is routinely exhausted.
 */

const CACHE_SECONDS = 60 * 60 * 24;

/** Google sizes covers by URL parameter, and serves http:// by default. */
const httpsCover = (url: string) => url.replace(/^http:/, "https:");

/**
 * Google's blurbs sometimes carry markup. This is rendered as text, never as
 * HTML, so strip the tags rather than letting "<p>" show up on the page.
 */
const asPlainText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type GoogleVolume = {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

async function fromGoogle(
  title: string,
  author: string,
  key: string,
): Promise<BookDetails | null> {
  const q = [`intitle:${title}`, author ? `inauthor:${author}` : ""]
    .filter(Boolean)
    .join(" ");
  const params = new URLSearchParams({ q, maxResults: "1", key });

  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?${params}`,
    {
      next: { revalidate: CACHE_SECONDS },
    },
  );

  if (!res.ok) {
    // Falling through to Open Library keeps the page working, but a
    // misconfigured key would otherwise look identical to "no key at all" —
    // so say why out loud rather than degrading in silence.
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    } | null;
    const reason = body?.error?.errors?.[0]?.reason ?? "";
    console.warn(
      `[book-metadata] Google Books refused the request (${res.status}${reason ? ` ${reason}` : ""}): ` +
        `${body?.error?.message ?? "no detail"} — falling back to Open Library.` +
        (reason === "forbidden" || res.status === 403
          ? " Enable the Books API for this key's project at" +
            " https://console.cloud.google.com/apis/library/books.googleapis.com," +
            " and make sure the key has no HTTP-referrer restriction (server calls send no referrer)."
          : ""),
    );
    return null;
  }

  const body = (await res.json()) as { items?: GoogleVolume[] };
  const info = body.items?.[0]?.volumeInfo;
  if (!info?.title) return null;

  const year = Number.parseInt(info.publishedDate?.slice(0, 4) ?? "", 10);

  return {
    sources: ["google"],
    title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
    authors: info.authors ?? [],
    firstPublishYear: Number.isFinite(year) ? year : null,
    publisher: info.publisher ?? "",
    description: asPlainText(info.description ?? ""),
    pageCount: info.pageCount ?? null,
    coverUrl: httpsCover(
      info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? "",
    ),
    subjects: info.categories ?? [],
  };
}

type OpenLibraryDoc = {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  cover_i?: number;
  subject?: string[];
  number_of_pages_median?: number;
  key?: string;
};

async function fromOpenLibrary(
  title: string,
  author: string,
): Promise<BookDetails | null> {
  const params = new URLSearchParams({
    title,
    limit: "1",
    fields:
      "title,author_name,first_publish_year,publisher,cover_i,subject,number_of_pages_median,key",
  });
  if (author) params.set("author", author);

  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!res.ok) return null;

  const body = (await res.json()) as { docs?: OpenLibraryDoc[] };
  const doc = body.docs?.[0];
  if (!doc?.title) return null;

  return {
    sources: ["openlibrary"],
    title: doc.title,
    authors: doc.author_name ?? [],
    firstPublishYear: doc.first_publish_year ?? null,
    // Open Library's publisher is per-edition, so for anything long out of
    // copyright it returns whichever reprint happens to sort first — naming
    // "IndyPublish.com" as Austen's publisher is worse than saying nothing.
    publisher: "",
    // The search index carries no blurb; the facts above are what it is good for.
    description: "",
    pageCount: doc.number_of_pages_median ?? null,
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : "",
    subjects: (doc.subject ?? []).slice(0, 8),
  };
}

/**
 * Both providers at once, each field taken from the one that gets it right.
 *
 * Google's `publishedDate` is deliberately ignored whenever Open Library has a
 * first_publish_year: for a classic, Google's is the date of some reprint.
 */
function merge(
  google: BookDetails | null,
  openLibrary: BookDetails | null,
): BookDetails | null {
  if (!google) return openLibrary;
  if (!openLibrary) return google;

  // Google's publisher belongs to the edition it matched, so it is only worth
  // printing when that edition is close to the original — "Leonardo Lumbreras
  // (2021)" is a true fact about a reprint and a useless one about Frankenstein.
  const editionYear = google.firstPublishYear;
  const workYear = openLibrary.firstPublishYear;
  const publisherIsTheWorks =
    !workYear || !editionYear || Math.abs(editionYear - workYear) <= 5;

  return {
    sources: ["google", "openlibrary"],
    // Open Library's titles are cleaner; Google's often bolt the author on.
    title: openLibrary.title || google.title,
    authors: openLibrary.authors.length ? openLibrary.authors : google.authors,
    // The work's date, not the edition's.
    firstPublishYear: openLibrary.firstPublishYear ?? google.firstPublishYear,
    publisher: publisherIsTheWorks ? google.publisher : "",
    // The one thing Open Library's search index cannot give us.
    description: google.description,
    // A median across editions beats whichever one Google matched.
    pageCount: openLibrary.pageCount ?? google.pageCount,
    coverUrl: openLibrary.coverUrl || google.coverUrl,
    subjects: openLibrary.subjects.length
      ? openLibrary.subjects
      : google.subjects,
  };
}

export async function fetchDetails(
  title: string,
  author: string,
): Promise<BookDetails | null> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;

  const [google, openLibrary] = await Promise.all([
    key
      ? fromGoogle(title, author, key).catch((err) => {
          console.warn("[book-metadata] Google Books lookup threw:", err);
          return null;
        })
      : Promise.resolve(null),
    fromOpenLibrary(title, author).catch((err) => {
      console.warn("[book-metadata] Open Library lookup threw:", err);
      return null;
    }),
  ]);

  return merge(google, openLibrary);
}
