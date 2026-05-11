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
      } finally {
        setLoading(false);
      }
    }
    fetchCertificates();
  }, [certificateNFT, account]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold text-white mb-8">My Certificates</h2>
      {certificates.length === 0 ? (
        <p className="text-gray-400">No certificates yet. Complete a course to earn one!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <div
              key={cert.tokenId}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-indigo-400 font-semibold text-lg">
                  Course #{cert.courseId}
                </span>
                <span className="text-gray-500 text-xs font-mono">Token #{cert.tokenId}</span>
              </div>
              <p className="text-gray-400 text-sm">
                Issued: {new Date(cert.issuedAt * 1000).toLocaleDateString()}
              </p>
              <a
                href={ipfsToHttp(cert.ipfsHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 text-sm underline"
              >
                View on IPFS
              </a>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
