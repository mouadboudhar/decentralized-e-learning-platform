import { useState, useEffect, useCallback, useMemo } from "react";
import { ethers } from "ethers";
import { CourseCard } from "../components/CourseCard";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../utils/contracts";

export function Courses({ account, courseRegistry }) {
  const [courses, setCourses] = useState([]);
  const [enrolledMap, setEnrolledMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Read-only contract for fetching courses without a connected wallet
  const readContract = useMemo(() => {
    if (courseRegistry) return courseRegistry;
    if (!window.ethereum) return null;
    const provider = new ethers.BrowserProvider(window.ethereum);
    return new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);
  }, [courseRegistry]);

  const fetchCourses = useCallback(async () => {
    if (!readContract) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const count = await readContract.courseCount();
      const list = [];
      for (let i = 1; i <= Number(count); i++) {
        const course = await readContract.courses(i);
        list.push(course);
      }
      setCourses(list);

      if (account && courseRegistry) {
        const enrolled = {};
        for (const course of list) {
          enrolled[Number(course.id)] = await courseRegistry.isEnrolled(
            Number(course.id),
            account
          );
        }
        setEnrolledMap(enrolled);
      }
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    } finally {
      setLoading(false);
    }
  }, [readContract, courseRegistry, account]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  async function handleEnroll(courseId) {
    if (!courseRegistry) return;
    const course = courses.find((c) => Number(c.id) === courseId);
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
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold text-white mb-8">Available Courses</h2>
      {courses.length === 0 ? (
        <p className="text-gray-400">No courses yet. Be the first to create one!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={Number(course.id)}
              courseId={Number(course.id)}
              ipfsHash={course.ipfsHash}
              price={course.price}
              enrolled={enrolledMap[Number(course.id)] || false}
              onEnroll={handleEnroll}
            />
          ))}
        </div>
      )}
    </main>
  );
}
