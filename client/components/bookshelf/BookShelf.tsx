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
    title: "Frankenstein",
    author: "Mary Shelley",
    cover: "/covers/Frankenstein.jpg",
  },
  {
    id: 2,
    title: "Metamorphosis",
    author: "Franz Kafka",
    cover: "/covers/Metamorphosis.jpg",
  },
  {
    id: 3,
    title: "Narrative of the Life of Frederick Douglass",
    author: "Frederick Douglass",
    cover: "/covers/NarrativeOfFrederickDouglass.jpeg",
  },
  {
    id: 4,
    title: "Pride and Prejudice",
    author: "Jane Austen",
    cover: "/covers/PrideAndPrejudice.jpeg",
  },
  {
    id: 5,
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    cover: "/covers/TheGreatGatsby.jpg",
  },
];

export default function BookShelf() {
  const [selected, setSelected] = useState<{
    book: Book;
    el: HTMLElement;
  } | null>(null);

  return (
    <>
      <section className="w-full py-10">
        <div className="mx-auto max-w-7xl">
          {/* Bookshelf */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {books.map((book) => (
              <BookCard
                key={book.id}
                title={book.title}
                author={book.author}
                cover={book.cover}
                hidden={selected?.book.id === book.id}
                onClick={(el) => !selected && setSelected({ book, el })}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 3D Book Viewer — the card itself hides while its copy is in flight */}
      {selected && (
        <BookViewer
          book={selected.book}
          sourceEl={selected.el}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
