import PageShell, { PageTitle } from "@/components/PageShell";
import BookShelf from "@/components/bookshelf/BookShelf";

export default function ExplorePage() {
  return (
    // `fit` locks the page to the viewport on a wide screen and widens the
    // column from max-w-3xl to max-w-6xl, so the shelf stops scrolling and
    // stops sitting in a narrow strip with empty margins either side.
    <PageShell fit>
      {/*
        The heading sits beside the shelf on a wide screen rather than above it.
        Stacked, it and the page chrome ate well over a third of a short laptop
        window and the covers were left tiny; alongside, the shelf gets the full
        height and the heading fills width that was empty anyway.
      */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-10 xl:gap-14">
        <div className="lg:flex lg:w-64 lg:flex-none lg:flex-col lg:justify-center xl:w-72">
          <PageTitle
            compact
            title="EXPLORE"
            subtitle="Find out what Semantica has to say about your favorite books"
          />
        </div>
        <BookShelf />
      </div>
    </PageShell>
  );
}
