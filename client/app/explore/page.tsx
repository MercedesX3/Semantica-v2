import ButterflyBackground from "@/components/butterflies/ButterflyBackground";
import BackHomeButton from "@/components/BackHomeButton";
import BookShelf from "@/components/bookshelf/BookShelf";

export default function ExplorePage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#D7D8D0] p-10 font-sans">
      <div className="relative flex flex-1 overflow-hidden rounded-[40px] bg-white">
        <ButterflyBackground />
        <BackHomeButton />

        <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-start justify-center px-4 py-8">
          <h1>EXPLORE</h1>
          <h2 className="text-lg text-left whitespace-nowrap">
            Find out what Semantica has to say about your favorite books
          </h2>
          <BookShelf />
        </main>
      </div>
    </div>
  );
}
