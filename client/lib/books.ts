import type { SoundArchetype } from "@/lib/bookMetadata";

export interface ShelfBook {
  /** The URL segment: /explore/[slug]. */
  slug: string;
  title: string;
  author: string;
  cover?: string;
  /**
   * The id this book's analysis is saved under in the API. It is the title
   * slugified — see createBookId — so an upload of this title lands on exactly
   * this record and replaces it rather than adding a copy.
   */
  bookId: string;
  summary: string;
  /**
   * Overrides the archetype the lookup works out for itself.
   *
   * resolveSoundArchetype reads a book's era before its genre, which is right
   * for Kafka — libraries file him under "Fantasy fiction" and a sci-fi score
   * would be wrong — but it sweeps every pre-1960 book into `historical`. A
   * Wells invasion novel and a Buchan chase thriller deserve their own sound,
   * and that is a judgement about the book, not something a publication date
   * can be asked to make. Set it here when the derived answer is wrong.
   */
  soundArchetype?: SoundArchetype;
}

// Placeholder copy until the real summaries are written.
const DUMMY_SUMMARY =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";

export const BOOKS: ShelfBook[] = [
  {
    slug: "frankenstein",
    title: "Frankenstein",
    author: "Mary Shelley",
    cover: "/covers/Frankenstein.jpg",
    bookId: "frankenstein",
    summary: DUMMY_SUMMARY,
  },
  {
    slug: "metamorphosis",
    title: "Metamorphosis",
    author: "Franz Kafka",
    cover: "/covers/Metamorphosis.jpg",
    bookId: "metamorphosis",
    summary: DUMMY_SUMMARY,
  },
  {
    slug: "narrative-of-frederick-douglass",
    title: "Narrative of the Life of Frederick Douglass",
    author: "Frederick Douglass",
    cover: "/covers/NarrativeOfFrederickDouglass.jpeg",
    bookId: "narrative-of-frederick-douglass",
    summary: DUMMY_SUMMARY,
  },
  {
    slug: "pride-and-prejudice",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    cover: "/covers/PrideAndPrejudice.jpeg",
    bookId: "pride-and-prejudice",
    summary: DUMMY_SUMMARY,
  },
  {
    slug: "the-great-gatsby",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    cover: "/covers/TheGreatGatsby.jpg",
    bookId: "the-great-gatsby",
    summary: DUMMY_SUMMARY,
    soundArchetype: "contemporary",
  },
  {
    slug: "the-thirty-nine-steps",
    title: "The Thirty-Nine Steps",
    author: "John Buchan",
    cover: "/covers/TheThirtyNineSteps.jpg",
    bookId: "the-thirty-nine-steps",
    summary: DUMMY_SUMMARY,
    soundArchetype: "thriller",
  },
  {
    slug: "the-war-of-the-worlds",
    title: "The War of the Worlds",
    author: "H. G. Wells",
    // The file is named TheWorldOfTheWorlds; the book is The War of the Worlds.
    cover: "/covers/TheWorldOfTheWorlds.jpeg",
    bookId: "the-war-of-the-worlds",
    soundArchetype: "scifi",
    summary: DUMMY_SUMMARY,
  },
];

export const findBook = (slug: string) => BOOKS.find((b) => b.slug === slug);
