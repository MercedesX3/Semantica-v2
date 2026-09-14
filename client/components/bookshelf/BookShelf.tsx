import BookCard from "./BookCard";
import { BOOKS } from "@/lib/books";

export default function BookShelf() {
  return (
    <section className="w-full pt-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
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
      </div>
    </section>
  );
}
