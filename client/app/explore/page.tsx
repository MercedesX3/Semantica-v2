import ButterflyBackground from "@/components/butterflies/ButterflyBackground";

export default function ExplorePage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#D7D8D0] p-10 font-sans">
      <div className="relative flex flex-1 overflow-hidden rounded-[40px] bg-white">
        <ButterflyBackground />

        <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-start justify-center px-4">
          <h1>EXPLORE</h1>
          <h2 className="text-lg text-left whitespace-nowrap">
            Upload your book to explore its emotional DNA.
          </h2>
        </main>
      </div>
    </div>
  );
}
