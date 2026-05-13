import { Link } from "react-router-dom";

const features = [
  {
    n: "01",
    title: "On-chain enrollment",
    body: "Pay directly in ETH. No payment processor, no chargebacks. Just a smart contract.",
  },
  {
    n: "02",
    title: "Soulbound certificates",
    body: "ERC-721 NFTs tied to your wallet. Non-transferable. Unforgeable. Yours.",
  },
  {
    n: "03",
    title: "No middleman",
    body: "Instructors get paid directly. No platform fee. No account bans. No censorship.",
  },
];

const steps = [
  { n: "01", title: "Browse and enroll", body: "Find a course. Send ETH directly to the contract." },
  { n: "02", title: "Complete the course", body: "Work through every section and lesson at your own pace." },
  { n: "03", title: "Claim your credential", body: "A soulbound certificate is minted to your wallet." },
];

export function Home() {
  return (
    <div style={{ background: "var(--bg)" }}>
      {/* Ticker bar */}
      <div
        className="ticker-bar font-mono text-xs uppercase tracking-[0.2em] py-2 px-6 flex justify-between items-center"
        style={{ color: "var(--muted)" }}
      >
        <span>ETH / Sepolia · Live</span>
        <span className="hidden md:inline">Edition Vol. 01</span>
        <span style={{ color: "var(--accent)" }}>EST. 2026</span>
      </div>

      {/* Hero — magazine style with rule lines */}
      <section
        className="max-w-[1440px] mx-auto px-6 py-20"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <p className="eyebrow mb-8">— Issue No. 01 / Decentralized Learning</p>

        <h1
          className="font-display font-bold leading-[0.92] tracking-[-0.03em] mb-10"
          style={{
            fontSize: "clamp(3.5rem, 9vw, 8rem)",
            color: "var(--text)",
          }}
        >
          Learn.<br />
          Earn.<br />
          <span style={{ color: "var(--accent)" }}>Own it.</span>
        </h1>

        <div className="grid grid-cols-12 gap-6 items-end">
          <p
            className="col-span-12 md:col-span-7 text-lg md:text-xl leading-relaxed max-w-2xl"
            style={{ color: "var(--muted)" }}
          >
            A decentralized e-learning platform where instructors publish on-chain courses,
            students pay directly in ETH, and credentials are minted as soulbound NFTs.
            No intermediary. No revocation. No noise.
          </p>

          <div className="col-span-12 md:col-span-5 flex flex-wrap gap-3 md:justify-end">
            <Link to="/courses" className="btn btn-primary btn-lg">
              Browse Courses →
            </Link>
            <Link to="/create" className="btn btn-outline btn-lg">
              Teach
            </Link>
          </div>
        </div>
      </section>

      {/* Index strip — data row, Bloomberg style */}
      <section
        className="max-w-[1440px] mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {[
          { label: "Network", value: "Ethereum" },
          { label: "Standard", value: "ERC-721" },
          { label: "Storage", value: "On-chain" },
          { label: "Fees", value: "0%" },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="eyebrow mb-1">{label}</p>
            <p className="font-mono text-base" style={{ color: "var(--text)" }}>{value}</p>
          </div>
        ))}
      </section>

      {/* Features */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <div className="flex items-baseline justify-between mb-12">
          <h2
            className="font-display font-semibold"
            style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", color: "var(--text)" }}
          >
            What you get
          </h2>
          <span className="eyebrow hidden md:inline">Section 02</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3" style={{ borderTop: "1px solid var(--border)" }}>
          {features.map(({ n, title, body }, i) => (
            <div
              key={n}
              className="p-8"
              style={{
                borderBottom: "1px solid var(--border)",
                borderRight: i < 2 ? "1px solid var(--border)" : "none",
              }}
            >
              <p className="font-mono text-xs mb-6" style={{ color: "var(--accent)" }}>{n}</p>
              <h3
                className="font-display font-semibold text-xl mb-3"
                style={{ color: "var(--text)" }}
              >
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        className="max-w-[1440px] mx-auto px-6 py-20"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="flex items-baseline justify-between mb-12">
          <h2
            className="font-display font-semibold"
            style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", color: "var(--text)" }}
          >
            How it works
          </h2>
          <span className="eyebrow hidden md:inline">Section 03</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: "var(--border)" }}>
          {steps.map(({ n, title, body }) => (
            <div key={n} className="p-8" style={{ background: "var(--bg)" }}>
              <p
                className="font-display font-bold mb-6"
                style={{ fontSize: "3.5rem", color: "var(--accent)", lineHeight: 1 }}
              >
                {n}
              </p>
              <h3 className="font-display font-semibold text-lg mb-2" style={{ color: "var(--text)" }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer
        className="max-w-[1440px] mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs uppercase tracking-[0.18em]"
        style={{
          borderTop: "1px solid var(--border)",
          color: "var(--muted)",
        }}
      >
        <span>LearnChain Editorial</span>
        <span>© 2026 — Open Protocol</span>
      </footer>
    </div>
  );
}
