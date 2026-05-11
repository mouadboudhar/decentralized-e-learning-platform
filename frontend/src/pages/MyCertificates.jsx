import { useState, useEffect } from "react";
import { ipfsToHttp } from "../utils/ipfs";

export function MyCertificates({ account, certificateNFT }) {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCertificates() {
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
            return {
              tokenId: Number(tokenId),
              courseId: Number(cert.courseId),
              issuedAt: Number(cert.issuedAt),
              ipfsHash: cert.ipfsHash,
            };
          })
        );
        setCertificates(certs);
      } catch (err) {
        console.error("Failed to load certificates:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCertificates();
  }, [certificateNFT, account]);

  if (!account) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[70vh] gap-5 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl">
          🏆
        </div>
        <div>
          <p className="text-white font-semibold text-lg mb-1">Wallet not connected</p>
          <p className="text-gray-400 text-sm">Connect your wallet to view your certificates.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">My Certificates</h2>
        <p className="text-gray-500 text-sm mt-1">
          Soulbound NFTs issued to your wallet upon course completion
        </p>
      </div>

      {certificates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="text-5xl">🎓</div>
          <p className="text-white font-medium">No certificates yet</p>
          <p className="text-gray-500 text-sm">
            Complete a course and ask the instructor to issue your certificate.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {certificates.map((cert) => (
            <div
              key={cert.tokenId}
              className="relative rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-br from-indigo-900/20 via-purple-900/10 to-transparent"
            >
              {/* Gradient top bar */}
              <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-500" />

              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest">Certificate</p>
                    <h3 className="text-white font-semibold text-lg">Course #{cert.courseId}</h3>
                  </div>
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                    Token #{cert.tokenId}
                  </span>
                </div>

                <div className="text-sm text-gray-400">
                  Issued{" "}
                  <span className="text-gray-300">
                    {new Date(cert.issuedAt * 1000).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <a
                  href={ipfsToHttp(cert.ipfsHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
                >
                  View on IPFS
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
