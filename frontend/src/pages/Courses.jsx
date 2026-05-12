import { useState, useEffect, useCallback, useMemo } from "react";
import { ethers } from "ethers";
import { CourseCard } from "../components/CourseCard";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../utils/contracts";

const HARDHAT_CHAIN_ID = 31337;

async function getReadContract(courseRegistry) {
  // If already have a signer-based contract, use it directly
  if (courseRegistry) return courseRegistry;

  // MetaMask makes the actual HTTP call to the node — no CORS issue
  if (!window.ethereum) return null;

  const provider = new ethers.BrowserProvider(window.ethereum);

  // Verify MetaMask is on the Hardhat local network
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== HARDHAT_CHAIN_ID) {
    throw new Error(
      `MetaMask is on chain ${network.chainId}. Switch to the Hardhat local network (chain 31337 / localhost:8545).`
    );
  }

  return new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);
}

export function Courses({ account, courseRegistry }) {
  const [courses, setCourses] = useState([]);
  const [enrolledMap, setEnrolledMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const contract = await getReadContract(courseRegistry);

      if (!contract) {
        // MetaMask not installed — still show the page, just can't read chain
        if (!window.ethereum) {
          setError("Install MetaMask to browse courses.");
        }
        return;
      }

      const count = await contract.courseCount();
      const list = [];
      for (let i = 1; i <= Number(count); i++) {
        const c = await contract.courses(i);
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
        setEnrolledMap(enrolled);
      }
    } catch (err) {
      console.error("fetchCourses:", err);
      setError(err.message || "Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }, [courseRegistry, account]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

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
      await fetchCourses();
    } catch (err) {
      console.error("Enroll failed:", err);
      alert(err.reason || err.message);
    }
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading courses…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-6 text-center">
        <div className="text-4xl">⚠️</div>
        <div className="max-w-md">
          <p className="text-red-400 font-medium mb-2">{error}</p>
          {error.includes("chain") || error.includes("MetaMask") ? (
            <ol className="text-gray-500 text-sm text-left space-y-1 mt-3 list-decimal list-inside">
              <li>Open MetaMask → Networks → Add a network</li>
              <li>Network name: Hardhat, RPC: http://127.0.0.1:8545, Chain ID: 31337</li>
              <li>Switch to that network and refresh</li>
            </ol>
          ) : (
            <p className="text-gray-500 text-sm mt-1">
              Run <code className="bg-white/5 px-1 rounded text-gray-300">bash start.sh</code> from
              the project root, then refresh.
            </p>
          )}
        </div>
        <button
          onClick={fetchCourses}
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
