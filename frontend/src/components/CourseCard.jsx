import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ipfsToHttp } from "../utils/ipfs";

export function CourseCard({ courseId, ipfsHash, price, enrolled, onEnroll }) {
  const [title, setTitle] = useState(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    async function fetchMetadata() {
      try {
        const res = await fetch(ipfsToHttp(ipfsHash), { signal: controller.signal });
        if (!res.ok) throw new Error("not found");
        const data = await res.json();
        if (typeof data.title === "string") {
          setTitle(data.title);
          setDescription(data.description ?? "");
        } else {
          throw new Error("invalid metadata");
        }
      } catch {
        setTitle(`Course #${courseId}`);
        setDescription("");
      } finally {
        clearTimeout(timeout);
      }
    }

    fetchMetadata();
    return () => controller.abort();
  }, [ipfsHash, courseId]);

  const priceEth = ethers.formatEther(price.toString());

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-3 hover:border-indigo-700 transition-colors">
      <h3 className="text-white font-semibold text-lg leading-tight">
        {title ?? `Course #${courseId}`}
      </h3>
      {description ? (
        <p className="text-gray-400 text-sm line-clamp-2">{description}</p>
      ) : (
        <p className="text-gray-600 text-sm italic">No description</p>
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
