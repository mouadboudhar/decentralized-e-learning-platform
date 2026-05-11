import { Link } from "react-router-dom";

export function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
      <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
        Learn. Earn.{" "}
        <span className="text-indigo-400">Own Your Credentials.</span>
      </h1>
      <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
        A decentralized platform where instructors publish courses, students pay directly in ETH,
        and certificates are minted as soulbound NFTs on Ethereum — no middleman, no censorship.
      </p>
      <Link
        to="/courses"
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl text-lg font-medium transition-colors"
      >
        Browse Courses
      </Link>
    </main>
  );
}
