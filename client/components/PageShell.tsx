import type { ReactNode } from "react";
import ButterflyBackground from "@/components/butterflies/ButterflyBackground";
import BackHomeButton from "@/components/BackHomeButton";

/** The sage frame around every page. Home uses the same values in app/page.tsx. */
export const FRAME = "bg-[#D7D8D0] p-3 sm:p-6 lg:p-10";
export const CARD = "rounded-[28px] sm:rounded-[40px] bg-white";

/**
 * The white card with butterflies and a way home, for inner pages.
 *
 * Top padding clears the pinned Home button, so headings never sit beside it.
 * The butterflies measure <main>'s left edge to stay out of the text, so the
 * content has to be the <main> inside this card.
 */
export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className={`flex min-h-screen flex-1 flex-col font-sans ${FRAME}`}>
      <div className={`relative flex flex-1 overflow-hidden ${CARD}`}>
        <ButterflyBackground />
        <BackHomeButton />

        <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-start justify-center px-6 pt-24 pb-16 sm:px-10 sm:pt-28 sm:pb-20">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-w-0">
      <h1 style={{ fontSize: "clamp(44px, 12vw, 96px)", lineHeight: 1.05 }}>{title}</h1>
      <h2 className="mt-3 text-balance" style={{ fontSize: "clamp(19px, 3vw, 28px)", lineHeight: 1.3 }}>
        {subtitle}
      </h2>
    </div>
  );
}
