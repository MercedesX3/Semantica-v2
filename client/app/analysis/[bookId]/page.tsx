import PageShell from "@/components/PageShell";
import StoredAnalysisView from "@/components/analysis/StoredAnalysisView";

export default async function AnalysisPage({
  params,
}: PageProps<"/analysis/[bookId]">) {
  const { bookId } = await params;

  return (
    <PageShell>
      <StoredAnalysisView bookId={decodeURIComponent(bookId)} />
    </PageShell>
  );
}
