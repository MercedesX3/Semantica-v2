"use client";

interface BookCardProps {
  title: string;
  author: string;
  cover?: string;
  onClick: () => void;
}

export default function BookCard({
  title,
  author,
  cover,
  onClick,
}: BookCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative h-72 w-48 overflow-hidden rounded-lg text-left transition-all duration-300 hover:-translate-y-3 hover:scale-105"
    >
      {/* Book cover */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
        style={{
          backgroundImage: cover
            ? `url(${cover})`
            : "linear-gradient(135deg, #3b2f63, #171329)",
        }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Book information */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-white/70">{author}</p>
      </div>
    </button>
  );
}
