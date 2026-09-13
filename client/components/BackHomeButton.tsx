import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Pinned to the top-left of a page's white card; returns to the home page. */
export default function BackHomeButton() {
  return (
    <Link
      href="/"
      className="group absolute left-8 top-8 z-20 inline-flex items-center gap-2 rounded-[40px] bg-white/80 px-5 py-2 text-sm font-semibold text-stone-600 shadow-[0px_4px_4px_0px_rgba(142,142,142,0.25)] outline-2 -outline-offset-2 outline-stone-400 backdrop-blur-sm transition-all duration-300 ease-out hover:text-stone-900 hover:drop-shadow-2xl"
    >
      <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
      Home
    </Link>
  );
}
