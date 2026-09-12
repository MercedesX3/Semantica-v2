"use client";

import { useState } from "react";
import BookCard from "./BookCard";
import BookViewer from "../book-viewer/BookViewer";

interface Book {
  id: number;
  title: string;
  author: string;
  cover?: string;
}

const books: Book[] = [
  {
    id: 1,
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
  },
  {
    id: 2,
    title: "Pride and Prejudice",
    author: "Jane Austen",
  },
  {
    id: 3,
    title: "The Legends of King Arthur and His Knights",
    author: "Sir Thomas Malory and Sir James Knowles",
  },
];

export default function BookShelf() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  return (
    <>
      <section className="min-h-screen px-8 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <p className="mb-2 text-sm uppercase tracking-[0.3em] text-purple-400">
              Semantica
            </p>

            <h1 className="text-5xl font-bold text-black">
              Discover your next story.
            </h1>

            <p className="mt-4 max-w-xl text-gray-700">
              Explore books based on their emotional DNA, themes, characters,
              and the way their stories feel.
            </p>
          </div>

          {/* Bookshelf */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {books.map((book) => (
              <BookCard
                key={book.id}
                title={book.title}
                author={book.author}
                cover={book.cover}
                onClick={() => setSelectedBook(book)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 3D Book Viewer */}
      {selectedBook && (
        <BookViewer book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}
    </>
  );
}
