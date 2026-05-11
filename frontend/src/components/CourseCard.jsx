import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ipfsToHttp } from "../utils/ipfs";

export function CourseCard({ courseId, ipfsHash, price, instructor, enrolled, onEnroll }) {
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
      } finally {
        clearTimeout(timeout);
      }
    }

    fetchMetadata();
    return () => controller.abort();
  }, [ipfsHash, courseId]);

  const priceEth = ethers.formatEther(price.toString());
  const shortInstructor = instructor
    ? `${instructor.slice(0, 6)}…${instructor.slice(-4)}`
    : "";

  return (
    <div className="group relative rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent hover:border-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/5 transition-all flex flex-col overflow-hidden">
      {/* Top accent */}
      <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-transparent" />

      <div className="flex flex-col gap-3 p-5 flex-1">
        {/* Badge row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
            #{courseId}
          </span>
          <span className="text-xs text-gray-600 font-mono">{shortInstructor}</span>
        </div>

        {/* Title */}
        <h3 className="text-white font-semibold text-base leading-snug">
          {title ?? `Course #${courseId}`}
        </h3>

        {/* Description */}
        {description ? (
          <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">{description}</p>
        ) : (
          <p className="text-gray-600 text-sm italic">No description</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-white/5 bg-white/[0.02] mt-auto">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Price</p>
          <p className="text-indigo-300 font-mono font-medium text-sm">{priceEth} ETH</p>
        </div>
        <button
          onClick={() => onEnroll(courseId)}
          disabled={enrolled}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            enrolled
              ? "bg-green-500/10 border border-green-500/20 text-green-400 cursor-default"
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30"
          }`}
        >
          {enrolled ? "✓ Enrolled" : `Enroll`}
        </button>
      </div>
    </div>
  );
}
