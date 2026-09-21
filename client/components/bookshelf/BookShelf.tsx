import BookCard from "./BookCard";
import { BOOKS } from "@/lib/books";

/**
 * The shelf.
 *
 * On a wide screen the grid takes the height the page has left and the covers
 * are sized from the row height rather than the column width, so the shelf
 * fills the viewport instead of running off the bottom of it. Narrow screens
 * keep the ordinary width-driven grid and scroll, which is what a phone wants.
 */
export default function BookShelf() {
  return (
    <section className="mt-6 flex min-h-0 w-full flex-1 flex-col sm:mt-8 lg:mt-0 lg:h-full">
      {/*
        Four across, two down, each cover sized from the row height. With the
        heading moved out to the side the rows get the page's whole height, so
        the covers come out close to the column width and the shelf reads as
        full rather than as a row of stamps with gaps between them.
      */}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 lg:auto-rows-min lg:place-items-center lg:content-center lg:gap-5">
        {BOOKS.map((book) => (
          <BookCard
            key={book.slug}
            href={`/explore/${book.slug}`}
            title={book.title}
            author={book.author}
            cover={book.cover}
          />
        ))}
      </div>
    </section>
  );
}
