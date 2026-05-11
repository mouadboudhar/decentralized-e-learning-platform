import { Link } from "react-router-dom";

const features = [
  {
    icon: "⛓",
    title: "On-chain enrollment",
    body: "Pay directly in ETH. No payment processor, no chargebacks — just a smart contract.",
  },
  {
    icon: "🎓",
    title: "Soulbound certificates",
    body: "Certificates are ERC-721 NFTs tied permanently to your wallet. Non-transferable, unforgeable.",
  },
  {
    icon: "🔓",
    title: "No middleman",
    body: "Instructors receive payments directly. No platform fee. No account bans. No censorship.",
  },
];

const steps = [
  { n: "01", title: "Browse & enroll", body: "Find a course, send ETH directly to the contract." },
  { n: "02", title: "Complete the course", body: "Instructor marks you complete once you finish." },
  { n: "03", title: "Claim your certificate", body: "An NFT certificate is minted to your wallet — yours forever." },
];

export function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-60 -left-40 w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[100px]" />

      {/* Hero */}
      <section className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Running on Ethereum · Powered by IPFS
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.08]">
          Learn.{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Earn.
          </span>
          <br />
          Own Your Credentials.
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          A decentralized e-learning platform where instructors publish courses, students pay
          directly in ETH, and certificates are minted as soulbound NFTs — no middleman, no
          censorship.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/courses"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-3 rounded-xl text-base font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
          >
            Browse Courses
          </Link>
          <Link
            to="/create"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white px-8 py-3 rounded-xl text-base font-medium transition-all"
          >
            Become an Instructor
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map(({ icon, title, body }) => (
            <div
              key={title}
              className="relative rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 hover:border-indigo-500/20 transition-colors group"
            >
              <div className="text-3xl mb-4">{icon}</div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/5 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-white text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map(({ n, title, body }) => (
              <div key={n} className="flex flex-col items-start gap-3">
                <span className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  {n}
                </span>
                <h3 className="text-white font-semibold">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
