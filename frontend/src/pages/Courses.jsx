import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { CourseCard } from "../components/CourseCard";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../utils/contracts";

// Reads go through the Vite dev-server proxy (/rpc → hardhat-node:8545).
// Server-side forwarding: zero CORS, no MetaMask needed, works in Docker and WSL2.
function makeReadProvider() {
  return new ethers.JsonRpcProvider(
    `${window.location.origin}/rpc`,
    { chainId: 31337, name: "hardhat" },
    { staticNetwork: true }
  );
}

// Retry on transient errors: node not yet ready or contract not yet deployed
function isRetryable(err) {
  return ['BAD_DATA', 'NETWORK_ERROR', 'SERVER_ERROR', 'UNKNOWN_ERROR'].includes(err?.code);
}

const MAX_RETRIES = 15; // ~30 seconds
const RETRY_MS = 2000;

export function Courses({ account, courseRegistry }) {
  const [courses, setCourses] = useState([]);
  const [enrolledMap, setEnrolledMap] = useState({});
  const [phase, setPhase] = useState("loading"); // loading | waiting | ready | error
  const [error, setError] = useState(null);
  const [retries, setRetries] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const readContract = useMemo(() => {
    if (courseRegistry) return courseRegistry;
    return new ethers.Contract(
      COURSE_REGISTRY_ADDRESS,
      COURSE_REGISTRY_ABI,
      makeReadProvider()
    );
  }, [courseRegistry]);

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

          if (account && courseRegistry) {
            const enrolled = {};
            for (const c of list) {
              enrolled[c.id] = await courseRegistry.isEnrolled(c.id, account);
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
  }, [readContract, courseRegistry, account, refreshKey]);

  async function handleEnroll(courseId) {
    if (!courseRegistry) {
      alert("Connect your wallet to enroll.");
      return;
    }
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;
    try {
      const tx = await courseRegistry.enroll(courseId, { value: course.price });
      await tx.wait();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Enroll failed:", err);
      alert(err.reason || err.message);
    }
  }

  if (phase === "loading") {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Connecting to blockchain node…</p>
        </div>
      </main>
    );
  }

  if (phase === "waiting") {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">
            Waiting for node to finish deploying… ({retries}/{MAX_RETRIES})
          </p>
          <p className="text-gray-600 text-xs">
            Make sure <code className="bg-white/5 px-1 rounded">bash start.sh</code> is running.
          </p>
        </div>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-6 text-center">
        <div className="text-4xl">⚠️</div>
        <div className="max-w-md">
          <p className="text-red-400 font-medium mb-2">Could not connect to the blockchain node.</p>
          <ol className="text-gray-500 text-sm text-left space-y-1 mt-3 list-decimal list-inside">
            <li>Run <code className="bg-white/5 px-1 rounded text-gray-300">bash start.sh</code> from the project root</li>
            <li>Wait for "Hardhat node ready" to appear in the terminal</li>
            <li>Then refresh this page or click Retry</li>
          </ol>
          {error && (
            <p className="text-gray-600 text-xs mt-3 font-mono break-all">{error}</p>
          )}
        </div>
        <button
          onClick={() => { setPhase("loading"); setRetries(0); setRefreshKey((k) => k + 1); }}
          className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-5 py-2 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white">Available Courses</h2>
          <p className="text-gray-500 text-sm mt-1">
            {courses.length} course{courses.length !== 1 ? "s" : ""} on-chain
          </p>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="text-5xl">📚</div>
          <p className="text-white font-medium">No courses yet</p>
          <p className="text-gray-500 text-sm">Be the first to publish one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              courseId={course.id}
              ipfsHash={course.ipfsHash}
              price={course.price}
              instructor={course.instructor}
              enrolled={enrolledMap[course.id] || false}
              onEnroll={handleEnroll}
            />
          ))}
        </div>
      )}
    </main>
  );
}
