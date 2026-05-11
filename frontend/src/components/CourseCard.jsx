import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ipfsToHttp } from "../utils/ipfs";

export function CourseCard({ courseId, ipfsHash, price, enrolled, onEnroll }) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const url = ipfsToHttp(ipfsHash);
        const res = await fetch(url);
        const data = await res.json();
        setMetadata(data);
      } catch {
        setMetadata({ title: `Course #${courseId}`, description: "" });
      } finally {
        setLoading(false);
      }
    }
    fetchMetadata();
  }, [ipfsHash, courseId]);

  const priceEth = ethers.formatEther(price.toString());

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-3 hover:border-indigo-700 transition-colors">
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <>
          <h3 className="text-white font-semibold text-lg leading-tight">{metadata.title}</h3>
          <p className="text-gray-400 text-sm line-clamp-2">{metadata.description}</p>
        </>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-800">
        <span className="text-indigo-300 font-mono text-sm">{priceEth} ETH</span>
        <button
          onClick={() => onEnroll(courseId)}
          disabled={enrolled}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            enrolled
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          }`}
        >
          {enrolled ? "Enrolled" : `Enroll · ${priceEth} ETH`}
        </button>
      </div>
    </div>
  );
}
