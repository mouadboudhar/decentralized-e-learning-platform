import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { ipfsToHttp } from "../utils/ipfs";
import {
  CERTIFICATE_NFT_ADDRESS,
  COURSE_REGISTRY_ADDRESS,
  COURSE_REGISTRY_ABI,
} from "../utils/contracts";

function makeReadRegistry() {
  const provider = new ethers.JsonRpcProvider(
    `${window.location.origin}/rpc`,
    { chainId: 31337, name: "hardhat" },
    { staticNetwork: true }
  );
  return new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);
}

async function fetchCourseTitle(ipfsHash, fallback) {
  try {
    const res = await fetch(ipfsToHttp(ipfsHash));
    if (!res.ok) return fallback;
    const data = await res.json();
    return typeof data.title === "string" ? data.title : fallback;
  } catch {
    return fallback;
  }
}

export function MyCertificates({ account, certificateNFT }) {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  const readRegistry = useMemo(() => makeReadRegistry(), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!certificateNFT || !account) {
        setLoading(false);
        return;
      }
      try {
        const filter = certificateNFT.filters.CertificateMinted(null, account);
        const events = await certificateNFT.queryFilter(filter);
        const certs = await Promise.all(
          events.map(async (evt) => {
            const tokenId = evt.args[0];
            const cert = await certificateNFT.certificates(tokenId);
            const courseId = Number(cert.courseId);
            let title = `Course #${courseId}`;
            try {
              const course = await readRegistry.courses(courseId);
              title = await fetchCourseTitle(course.ipfsHash, title);
            } catch {
              // course lookup failed, keep fallback
            }
            return {
              tokenId: Number(tokenId),
              courseId,
              issuedAt: Number(cert.issuedAt),
              ipfsHash: cert.ipfsHash,
              title,
            };
          })
        );
        if (!cancelled) setCertificates(certs);
      } catch (err) {
        console.error("Failed to load certificates:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [certificateNFT, account, readRegistry]);

  if (!account) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="eyebrow mb-3">Restricted</p>
        <h1 className="font-display font-semibold text-3xl mb-3" style={{ color: "var(--text)" }}>
          Connect your wallet.
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Your certificates are tied to your wallet address.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
      </main>
    );
  }

  return (
    <main className="max-w-[1440px] mx-auto px-6 py-12">
      <header className="mb-10" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "1.5rem" }}>
        <p className="eyebrow mb-2">— Credentials / Soulbound</p>
        <h1 className="font-display font-bold tracking-[-0.02em]" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "var(--text)" }}>
          My Certificates
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
          ERC-721 certificates minted to <span className="font-mono">{account.slice(0,6)}…{account.slice(-4)}</span>
        </p>
      </header>

      {certificates.length === 0 ? (
        <div className="py-24 text-center">
          <p className="eyebrow mb-2">Empty</p>
          <p className="font-display text-2xl mb-3" style={{ color: "var(--text)" }}>
            You have not completed any courses yet.
          </p>
          <Link to="/courses" className="btn btn-primary">
            Browse courses →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "var(--border)" }}>
          {certificates.map((cert) => {
            const verifyUrl = `https://sepolia.etherscan.io/token/${CERTIFICATE_NFT_ADDRESS}?a=${account}`;
            const dateStr = new Date(cert.issuedAt * 1000).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
            return (
              <article key={cert.tokenId} className="p-8 flex flex-col gap-6" style={{ background: "var(--bg)" }}>
                <div className="flex items-start justify-between">
                  <p className="eyebrow">Certificate of Completion</p>
                  <span
                    className="font-mono text-xs px-2 py-1"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
                  >
                    № {String(cert.tokenId).padStart(4, "0")}
                  </span>
                </div>

                <h2 className="font-display font-bold leading-tight" style={{ fontSize: "1.85rem", color: "var(--text)" }}>
                  {cert.title}
                </h2>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="eyebrow mb-1">Issued to</p>
                    <p className="font-mono text-sm break-all" style={{ color: "var(--text)" }}>
                      {account.slice(0, 10)}…{account.slice(-8)}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow mb-1">Date</p>
                    <p className="font-mono text-sm" style={{ color: "var(--text)" }}>{dateStr}</p>
                  </div>
                  <div>
                    <p className="eyebrow mb-1">Course ID</p>
                    <p className="font-mono text-sm" style={{ color: "var(--text)" }}>#{cert.courseId}</p>
                  </div>
                  <div>
                    <p className="eyebrow mb-1">Token ID</p>
                    <p className="font-mono text-sm" style={{ color: "var(--text)" }}>{cert.tokenId}</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <a
                    href={verifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm mt-3"
                  >
                    Verify on-chain →
                  </a>
                  <Link to={`/courses/${cert.courseId}`} className="btn btn-ghost btn-sm mt-3">
                    View course →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
