import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import BookSentiment from "@/components/explore/BookSentiment";
import { BOOKS, findBook } from "@/lib/books";

export function generateStaticParams() {
  return BOOKS.map((book) => ({ slug: book.slug }));
}

export default async function BookPage({ params }: PageProps<"/explore/[slug]">) {
  const { slug } = await params;
  const book = findBook(slug);
  if (!book) notFound();

  return (
    <PageShell fit backHref="/explore" backLabel="Explore">
      <div className="grid w-full flex-1 gap-8 lg:min-h-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-12">
        {/* Left: cover, then the summary */}
        <section className="flex min-h-0 flex-col gap-5">
          <div
            className="aspect-[2/3] w-44 flex-none overflow-hidden rounded-lg bg-cover bg-center shadow-[0px_12px_30px_0px_rgba(0,0,0,0.25)] sm:w-52 lg:h-[min(32vh,26rem)] lg:w-auto lg:self-start"
            style={{
              backgroundImage: book.cover
                ? `url(${book.cover})`
                : "linear-gradient(135deg, #3b2f63, #171329)",
            }}
            role="img"
            aria-label={`Cover of ${book.title}`}
          />
          <div className="min-h-0 overflow-hidden">
            <h1 style={{ fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1.15 }}>{book.title}</h1>
            <p className="mt-1 text-stone-500">{book.author}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-stone-700">{book.summary}</p>
          </div>
        </section>

        {/* Right: sentiment from the API */}
        <section className="min-h-0">
          <BookSentiment bookId={book.bookId} />
        </section>
      </div>
    </PageShell>
  );
}
