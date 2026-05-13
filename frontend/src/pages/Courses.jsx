import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { CourseCard } from "../components/CourseCard";
import { ipfsToHttp } from "../utils/ipfs";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../utils/contracts";

function makeReadProvider() {
  return new ethers.JsonRpcProvider(
    `${window.location.origin}/rpc`,
    { chainId: 31337, name: "hardhat" },
    { staticNetwork: true }
  );
}

function isRetryable(err) {
  return ['BAD_DATA', 'NETWORK_ERROR', 'SERVER_ERROR', 'UNKNOWN_ERROR'].includes(err?.code);
}

const MAX_RETRIES = 15;
const RETRY_MS = 2000;

export function Courses({ account }) {
  const [courses, setCourses] = useState([]);
  const [titles, setTitles] = useState({}); // courseId -> string
  const [enrolledMap, setEnrolledMap] = useState({});
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState(null);
  const [retries, setRetries] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [diag, setDiag] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | free | paid
  const [sort, setSort] = useState("newest"); // newest | oldest | price-asc | price-desc

  const filtersActive = !!searchInput || filter !== "all" || sort !== "newest";
  const clearFilters = () => {
    setSearchInput("");
    setFilter("all");
    setSort("newest");
  };

  // Debounce search input by 300ms
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const readContract = useMemo(() => {
    return new ethers.Contract(
      COURSE_REGISTRY_ADDRESS,
      COURSE_REGISTRY_ABI,
      makeReadProvider()
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    async function fetchLoop() {
      while (!cancelled) {
        setPhase(attempt === 0 ? "loading" : "waiting");
        setRetries(attempt);

        try {
          const count = await readContract.courseCount();
          if (cancelled) return;

          try {
            const net = await readContract.runner.getNetwork();
            const block = await readContract.runner.getBlockNumber();
            if (!cancelled) setDiag({ chainId: Number(net.chainId), block });
          } catch { /* diagnostics only */ }

          const list = [];
          for (let i = 1; i <= Number(count); i++) {
            const c = await readContract.courses(i);
            if (cancelled) return;
            list.push({
              id: Number(c.id),
              instructor: c.instructor,
              ipfsHash: c.ipfsHash,
              price: c.price,
              active: c.active,
            });
          }
          setCourses(list);

          // Resolve titles in parallel (best-effort)
          Promise.all(
            list.map(async (c) => {
              try {
                const res = await fetch(ipfsToHttp(c.ipfsHash));
                if (!res.ok) return [c.id, `Course #${c.id}`];
                const data = await res.json();
                return [c.id, typeof data.title === "string" ? data.title : `Course #${c.id}`];
              } catch {
                return [c.id, `Course #${c.id}`];
              }
            })
          ).then((entries) => {
            if (!cancelled) setTitles(Object.fromEntries(entries));
          });

          if (account) {
            const enrolled = {};
            for (const c of list) {
              enrolled[c.id] = await readContract.isEnrolled(c.id, account);
            }
            if (!cancelled) setEnrolledMap(enrolled);
          }

          if (!cancelled) setPhase("ready");
          return;
        } catch (err) {
          if (cancelled) return;
          if (attempt < MAX_RETRIES && isRetryable(err)) {
            attempt++;
            await new Promise((r) => setTimeout(r, RETRY_MS));
            continue;
          }
          console.error("fetchCourses:", err);
          setError(err.message || "Failed to load courses.");
          setPhase("error");
          return;
        }
      }
    }

    fetchLoop();
    return () => { cancelled = true; };
  }, [readContract, account, refreshKey]);

  const filtered = useMemo(() => {
    let out = [...courses];
    if (search) {
      out = out.filter((c) => {
        const t = (titles[c.id] || `Course #${c.id}`).toLowerCase();
        return t.includes(search);
      });
    }
    if (filter === "free") out = out.filter((c) => c.price === 0n);
    if (filter === "paid") out = out.filter((c) => c.price > 0n);

    switch (sort) {
      case "oldest":
        out.sort((a, b) => a.id - b.id);
        break;
      case "price-asc":
        out.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
        break;
      case "price-desc":
        out.sort((a, b) => (a.price < b.price ? 1 : a.price > b.price ? -1 : 0));
        break;
      case "newest":
      default:
        out.sort((a, b) => b.id - a.id);
    }
    return out;
  }, [courses, titles, search, filter, sort]);

  if (phase === "loading" || phase === "waiting") {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-8 h-8 animate-spin"
            style={{
              border: "2px solid var(--border)",
              borderTopColor: "var(--accent)",
            }}
          />
          <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
            {phase === "loading"
              ? "Connecting to node…"
              : `Waiting for deployment (${retries}/${MAX_RETRIES})`}
          </p>
        </div>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="eyebrow mb-4" style={{ color: "var(--danger)" }}>Error</p>
        <h2 className="font-display text-2xl font-semibold mb-4" style={{ color: "var(--text)" }}>
          Could not connect to the blockchain node.
        </h2>
        <ol className="text-sm text-left space-y-2 mt-6" style={{ color: "var(--muted)" }}>
          <li>1. Run <code className="font-mono px-1" style={{ background: "var(--surface)", color: "var(--text)" }}>bash start.sh</code> from the project root.</li>
          <li>2. Wait for "Hardhat node ready" in the terminal.</li>
          <li>3. Refresh this page or click Retry below.</li>
        </ol>
        {error && (
          <p className="font-mono text-xs mt-4 break-all" style={{ color: "var(--muted-2)" }}>{error}</p>
        )}
        <button
          onClick={() => { setPhase("loading"); setRetries(0); setRefreshKey((k) => k + 1); }}
          className="btn btn-primary mt-6"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-[1440px] mx-auto px-6 py-12">
      {/* Header */}
      <header className="mb-10" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "1.5rem" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">— Catalogue / Vol. 01</p>
            <h1 className="font-display font-bold tracking-[-0.02em]" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "var(--text)" }}>
              All Courses
            </h1>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
            <span>
              Showing {filtered.length} of {courses.length} course{courses.length === 1 ? "" : "s"}
            </span>
            {filtersActive && (
              <button onClick={clearFilters} className="btn btn-ghost btn-sm">
                Clear filters
              </button>
            )}
            {diag && (
              <span style={{ color: "var(--muted-2)" }}>
                · Chain {diag.chainId} · Block {diag.block}
              </span>
            )}
            <button
              onClick={() => { setPhase("loading"); setRetries(0); setRefreshKey((k) => k + 1); }}
              className="btn btn-ghost btn-sm"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-8">
        <div className="md:col-span-6">
          <input
            type="search"
            placeholder="Search courses by title…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input"
          />
        </div>
        <div className="md:col-span-4 flex gap-2">
          {[
            { v: "all", l: "All" },
            { v: "free", l: "Free" },
            { v: "paid", l: "Paid" },
          ].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className="btn btn-sm flex-1"
              style={
                filter === v
                  ? { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "var(--accent)" }
                  : undefined
              }
            >
              {l}
            </button>
          ))}
        </div>
        <div className="md:col-span-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="eyebrow mb-2">Empty</p>
          <p className="font-display text-2xl mb-2" style={{ color: "var(--text)" }}>
            {courses.length === 0 ? "No courses yet." : "No matches."}
          </p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {courses.length === 0 ? "Be the first to publish one." : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: "var(--border)" }}>
          {filtered.map((course) => (
            <div key={course.id} style={{ background: "var(--bg)" }}>
              <CourseCard
                courseId={course.id}
                ipfsHash={course.ipfsHash}
                price={course.price}
                instructor={course.instructor}
                enrolled={enrolledMap[course.id] || false}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
