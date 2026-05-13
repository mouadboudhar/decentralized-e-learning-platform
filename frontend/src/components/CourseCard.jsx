import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { ipfsToHttp } from "../utils/ipfs";

export function CourseCard({ courseId, ipfsHash, price, instructor, enrolled }) {
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
  const free = priceEth === "0.0";
  const shortInstructor = instructor
    ? `${instructor.slice(0, 6)}…${instructor.slice(-4)}`
    : "";

  return (
    <Link
      to={`/courses/${courseId}`}
      className="card card-hoverable flex flex-col h-full group"
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
          № {String(courseId).padStart(3, "0")}
        </span>
        <span className="font-mono text-xs" style={{ color: "var(--muted-2)" }}>
          {shortInstructor}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-5 flex-1">
        <h3
          className="font-display font-semibold leading-tight"
          style={{ color: "var(--text)", fontSize: "1.25rem" }}
        >
          {title ?? `Course #${courseId}`}
        </h3>
        {description ? (
          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "var(--muted)" }}>
            {description}
          </p>
        ) : (
          <p className="text-sm italic" style={{ color: "var(--muted-2)" }}>No description</p>
        )}
      </div>

      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <div className="flex flex-col">
          <span className="eyebrow">Price</span>
          <span className="font-mono text-sm" style={{ color: free ? "var(--accent)" : "var(--text)" }}>
            {free ? "FREE" : `${priceEth} ETH`}
          </span>
        </div>
        <span
          className="font-mono text-xs uppercase tracking-[0.18em]"
          style={{ color: enrolled ? "var(--accent)" : "var(--muted)" }}
        >
          {enrolled ? "Enrolled →" : "View →"}
        </span>
      </div>
    </Link>
  );
}
