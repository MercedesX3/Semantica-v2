import PageShell, { PageTitle } from "@/components/PageShell";
import BookShelf from "@/components/bookshelf/BookShelf";

export default function ExplorePage() {
  return (
    <PageShell>
      <PageTitle
        title="EXPLORE"
        subtitle="Find out what Semantica has to say about your favorite books"
      />
      <BookShelf />
    </PageShell>
  );
}
