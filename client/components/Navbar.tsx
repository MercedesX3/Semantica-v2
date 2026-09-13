import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <p className="text-xl font-bold text-gray-900">SEMANTICA</p>
            </Link>
          </div>
          <div className="flex items-center">
            <Link href="/upload">
              <button className="px-4 py-2 bg-[#4D8937] text-white rounded-md hover:bg-[#4D8937]/80 transition-colors duration-300">
                Upload
              </button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
