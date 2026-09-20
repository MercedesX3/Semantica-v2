import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import BookExperience from "@/components/explore/BookExperience";
import { BOOKS, findBook } from "@/lib/books";

export function generateStaticParams() {
  return BOOKS.map((book) => ({ slug: book.slug }));
}

export default async function BookPage({ params }: PageProps<"/explore/[slug]">) {
  const { slug } = await params;
  const book = findBook(slug);
  if (!book) notFound();

  // The whole layout is client-side: the metadata lookup, the analysis and the
  // selected section are shared across both columns.
  return (
    <PageShell fit backHref="/explore" backLabel="Explore">
      <BookExperience book={book} />
    </PageShell>
  );
}
