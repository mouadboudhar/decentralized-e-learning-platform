import { useState, useEffect, useCallback, useMemo } from "react";
import { ethers } from "ethers";
import { CourseCard } from "../components/CourseCard";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../utils/contracts";

export function Courses({ account, courseRegistry }) {
  const [courses, setCourses] = useState([]);
  const [enrolledMap, setEnrolledMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // JsonRpcProvider reads directly from the local node — no MetaMask network dependency
  const readContract = useMemo(() => {
    if (courseRegistry) return courseRegistry;
    try {
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      return new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);
    } catch {
      return null;
    }
  }, [courseRegistry]);

  const fetchCourses = useCallback(async () => {
    if (!readContract) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const count = await readContract.courseCount();
      const list = [];
      for (let i = 1; i <= Number(count); i++) {
        const course = await readContract.courses(i);
        list.push({
          id: Number(course.id),
          instructor: course.instructor,
          ipfsHash: course.ipfsHash,
          price: course.price,
          active: course.active,
        });
      }
      setCourses(list);

      if (account && courseRegistry) {
        const enrolled = {};
        for (const course of list) {
          enrolled[course.id] = await courseRegistry.isEnrolled(course.id, account);
        }
        setEnrolledMap(enrolled);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
      setError("Could not connect to the local node. Make sure npx hardhat node is running.");
    } finally {
      setLoading(false);
    }
  }, [readContract, courseRegistry, account]);

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
      <main className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-red-400 font-medium">{error}</p>
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
          <p className="text-gray-500 text-sm mt-1">{courses.length} course{courses.length !== 1 ? "s" : ""} on-chain</p>
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
