export interface ShelfBook {
  /** The URL segment: /explore/[slug]. */
  slug: string;
  title: string;
  author: string;
  cover?: string;
  /**
   * The id this book's analysis is saved under in the API. Uploads save with a
   * random suffix (see createBookId), so paste the real id here once it's saved.
   */
  bookId: string;
  summary: string;
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
  },
];

export const findBook = (slug: string) => BOOKS.find((b) => b.slug === slug);
