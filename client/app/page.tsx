import BookShelf from "@/components/bookshelf/BookShelf";
import ButterflyBackground from "@/components/butterflies/ButterflyBackground";
import Link from "next/link";
import NavBar from "@/components/Navbar";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#D7D8D0] p-10 font-sans">
      {/* White layer: the butterflies live inside this, clipped to its corners */}
      <div className="relative flex flex-1 overflow-hidden rounded-[40px] bg-white">
        <ButterflyBackground />

        <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-start justify-center px-4">
          {/* <BookShelf /> */}

          <h1>SEMANTICA</h1>
          <h2 className="text-lg text-left whitespace-nowrap">
            A literary exploration of meaning and language
          </h2>
          <div className="mt-8 flex flex-row items-center gap-4">
            <Link href="/explore">
              <button className="px-8 py-2.5 bg-linear-80 from-stone-500 to-yellow-800 rounded-[40px] shadow-[0px_4px_4px_0px_rgba(142,142,142,0.25)] outline outline-2 outline-offset-[-2px] outline-stone-400 inline-flex justify-start items-start gap-2.5 overflow-hidden hover:drop-shadow-2xl transition-all duration-300 ease-out">
                <div className="justify-start text-stone-50 text-xl font-semibold font-['Inter']">
                  EXPLORE BOOKS
                </div>
              </button>
            </Link>
            <Link href="/upload">
              <button className="px-8 py-2.5 rounded-[40px] shadow-[0px_4px_4px_0px_rgba(142,142,142,0.25)] outline outline-4 outline-offset-[-4px] outline-stone-400 inline-flex justify-start items-start gap-2.5 overflow-hidden hover:drop-shadow-2xl transition-all duration-300 ease-out">
                <div className="justify-start text-stone-500 text-xl font-semibold font-['Inter']">
                  UPLOAD PDF
                </div>
              </button>
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
