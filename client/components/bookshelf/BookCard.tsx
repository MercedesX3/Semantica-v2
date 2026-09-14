import Link from "next/link";

interface BookCardProps {
  href: string;
  title: string;
  author: string;
  cover?: string;
}

export default function BookCard({ href, title, author, cover }: BookCardProps) {
  return (
    <Link
      href={href}
      className="group relative block aspect-[2/3] w-full overflow-hidden rounded-lg text-left transition-all duration-300 hover:-translate-y-3 hover:scale-105"
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
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white sm:p-4">
        <h3 className="line-clamp-3 text-sm leading-snug font-semibold sm:text-lg">{title}</h3>
        <p className="mt-1 truncate text-xs text-white/70 sm:text-sm">{author}</p>
      </div>
    </Link>
  );
}
