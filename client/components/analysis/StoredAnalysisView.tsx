"use client";

import { PageTitle } from "@/components/PageShell";
import BookAnalysisPanel from "@/components/upload/BookAnalysisPanel";
import { useStoredAnalysis } from "@/hooks/useStoredAnalysis";

export default function StoredAnalysisView({ bookId }: { bookId: string }) {
  const { state, title } = useStoredAnalysis(bookId);

  const subtitle =
    state.status === "complete"
      ? title || bookId
      : state.status === "error"
        ? "We couldn't load this analysis."
        : "Loading saved analysis...";

  return (
    <>
      <PageTitle title="ANALYSIS" subtitle={subtitle} />
      <div className="w-full">
        <BookAnalysisPanel state={state} fileName={title || bookId} />
      </div>
    </>
  );
}
