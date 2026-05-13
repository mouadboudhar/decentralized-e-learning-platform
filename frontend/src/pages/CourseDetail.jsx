import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ethers } from "ethers";
import { ipfsToHttp } from "../utils/ipfs";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../utils/contracts";

function makeReadProvider() {
  return new ethers.JsonRpcProvider(
    `${window.location.origin}/rpc`,
    { chainId: 31337, name: "hardhat" },
    { staticNetwork: true }
  );
}

function progressKey(account, courseId, lessonGlobalIndex) {
  return `learnchain.progress.${account ?? "guest"}.${courseId}.${lessonGlobalIndex}`;
}

export function CourseDetail({ account, courseRegistry, connect }) {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);

  const [course, setCourse] = useState(null); // { instructor, ipfsHash, price, title, description }
  const [sections, setSections] = useState([]); // [{ title, lessons: [{ title, content }] }]
  const [enrolled, setEnrolled] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState({ section: 0, lesson: 0 });
  const [expandedSection, setExpandedSection] = useState(0);
  const [progress, setProgress] = useState({}); // global lesson index -> bool
  const [actionPending, setActionPending] = useState(null);

  const readContract = useMemo(
    () => new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, makeReadProvider()),
    []
  );

  const globalIndex = useCallback(
    (s, l) => {
      let idx = 0;
      for (let i = 0; i < s; i++) idx += sections[i]?.lessons.length || 0;
      return idx + l;
    },
    [sections]
  );

  const flatLessons = useMemo(() => {
    const out = [];
    sections.forEach((sec, sIdx) => {
      sec.lessons.forEach((l, lIdx) => out.push({ sIdx, lIdx, title: l.title }));
    });
    return out;
  }, [sections]);

  const completedCount = useMemo(
    () => Object.values(progress).filter(Boolean).length,
    [progress]
  );
  const totalLessons = flatLessons.length;
  const allDone = totalLessons > 0 && completedCount === totalLessons;

  const loadProgress = useCallback(
    (count) => {
      const next = {};
      for (let i = 0; i < count; i++) {
        if (localStorage.getItem(progressKey(account, courseId, i)) === "1") {
          next[i] = true;
        }
      }
      setProgress(next);
    },
    [account, courseId]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const c = await readContract.courses(courseId);
        if (cancelled) return;
        if (!c || Number(c.id) === 0) throw new Error("Course not found.");

        let title = `Course #${courseId}`;
        let description = "";
        try {
          const res = await fetch(ipfsToHttp(c.ipfsHash));
          if (res.ok) {
            const data = await res.json();
            title = typeof data.title === "string" ? data.title : title;
            description = data.description ?? "";
          }
        } catch { /* metadata best-effort */ }

        const sectionCount = Number(await readContract.getSectionCount(courseId));
        const secs = [];
        for (let i = 0; i < sectionCount; i++) {
          const s = await readContract.getSection(courseId, i);
          secs.push({
            title: s.title,
            lessons: s.lessons.map((l) => ({ title: l.title, content: l.content })),
          });
        }
        if (cancelled) return;

        let isEnrolled = false;
        let isCompleted = false;
        if (account) {
          isEnrolled = await readContract.isEnrolled(courseId, account);
          isCompleted = await readContract.isCompleted(courseId, account);
        }

        setCourse({
          instructor: c.instructor,
          ipfsHash: c.ipfsHash,
          price: c.price,
          title,
          description,
        });
        setSections(secs);
        setEnrolled(isEnrolled);
        setCompleted(isCompleted);
        const totalLessonsCount = secs.reduce((a, s) => a + s.lessons.length, 0);
        loadProgress(totalLessonsCount);
        if (secs.length > 0 && secs[0].lessons.length > 0) {
          setSelected({ section: 0, lesson: 0 });
          setExpandedSection(0);
        }
      } catch (err) {
        console.error("CourseDetail load:", err);
        if (!cancelled) setError(err.message || "Failed to load course.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (Number.isFinite(courseId) && courseId > 0) load();
    return () => { cancelled = true; };
  }, [courseId, readContract, account, loadProgress]);

  const handleEnroll = async () => {
    if (!courseRegistry) { connect?.(); return; }
    setActionPending("enroll");
    try {
      const tx = await courseRegistry.enroll(courseId, { value: course.price });
      await tx.wait();
      setEnrolled(true);
    } catch (err) {
      alert(err.reason || err.shortMessage || err.message);
    } finally {
      setActionPending(null);
    }
  };

  const toggleLessonComplete = (sIdx, lIdx) => {
    const gIdx = globalIndex(sIdx, lIdx);
    const key = progressKey(account, courseId, gIdx);
    setProgress((p) => {
      const next = { ...p };
      if (next[gIdx]) {
        delete next[gIdx];
        localStorage.removeItem(key);
      } else {
        next[gIdx] = true;
        localStorage.setItem(key, "1");
      }
      return next;
    });
  };

  const handleCompleteCourse = async () => {
    if (!courseRegistry) return;
    setActionPending("complete");
    try {
      const tx = await courseRegistry.markComplete(courseId, account);
      await tx.wait();
      setCompleted(true);
    } catch (err) {
      alert(err.reason || err.shortMessage || err.message);
    } finally {
      setActionPending(null);
    }
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
      </main>
    );
  }
  if (error || !course) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="eyebrow mb-3" style={{ color: "var(--danger)" }}>Error</p>
        <h2 className="font-display text-2xl mb-3" style={{ color: "var(--text)" }}>
          {error || "Course not found."}
        </h2>
        <Link to="/courses" className="btn btn-outline mt-4">← Back to courses</Link>
      </main>
    );
  }

  const priceEth = ethers.formatEther(course.price.toString());
  const free = priceEth === "0.0";
  const shortInstructor = `${course.instructor.slice(0, 6)}…${course.instructor.slice(-4)}`;
  const selectedLesson = sections[selected.section]?.lessons[selected.lesson];
  const selectedGlobal = globalIndex(selected.section, selected.lesson);
  const selectedDone = !!progress[selectedGlobal];

  return (
    <main className="max-w-[1440px] mx-auto px-6 py-8">
      {/* Top bar */}
      <header
        className="flex flex-wrap items-start justify-between gap-4 mb-8 pb-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <p className="eyebrow mb-2">— Course № {String(courseId).padStart(3, "0")}</p>
          <h1
            className="font-display font-bold tracking-[-0.02em] leading-tight"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", color: "var(--text)" }}
          >
            {course.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
            <span>By {shortInstructor}</span>
            <span>·</span>
            <span style={{ color: free ? "var(--accent)" : "var(--text)" }}>
              {free ? "FREE" : `${priceEth} ETH`}
            </span>
            <span>·</span>
            <span>{sections.length} sections / {totalLessons} lessons</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {!account && (
            <button onClick={connect} className="btn btn-primary">Connect Wallet</button>
          )}
          {account && !enrolled && (
            <button onClick={handleEnroll} disabled={actionPending === "enroll"} className="btn btn-primary">
              {actionPending === "enroll" ? "Enrolling…" : free ? "Enroll for Free" : `Enroll · ${priceEth} ETH`}
            </button>
          )}
          {enrolled && !completed && (
            <span
              className="font-mono text-xs uppercase tracking-[0.18em] px-3 py-2"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--accent)" }}
            >
              ● Enrolled
            </span>
          )}
          {completed && (
            <Link to="/certificates"
              className="font-mono text-xs uppercase tracking-[0.18em] px-3 py-2"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              ✓ Completed → Certificates
            </Link>
          )}
        </div>
      </header>

      {/* Progress bar */}
      {totalLessons > 0 && (
        <div className="mb-6">
          <div className="flex items-baseline justify-between mb-2">
            <span className="eyebrow">Progress</span>
            <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
              {completedCount} / {totalLessons} lessons
            </span>
          </div>
          <div className="h-1" style={{ background: "var(--border)" }}>
            <div
              className="h-1"
              style={{
                background: "var(--accent)",
                width: `${(completedCount / totalLessons) * 100}%`,
                transition: "width 250ms ease",
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="lg:col-span-4">
          {course.description && (
            <div className="card p-4 mb-4">
              <p className="eyebrow mb-2">About</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--muted)" }}>
                {course.description}
              </p>
            </div>
          )}

          {sections.length === 0 ? (
            <p className="card p-4 text-sm" style={{ color: "var(--muted)" }}>
              No content yet.
            </p>
          ) : (
            <nav className="card divide-y" style={{ borderColor: "var(--border)" }}>
              {sections.map((sec, sIdx) => {
                const open = expandedSection === sIdx;
                return (
                  <div key={sIdx} style={{ borderBottom: sIdx === sections.length - 1 ? "none" : "1px solid var(--border)" }}>
                    <button
                      onClick={() => setExpandedSection(open ? -1 : sIdx)}
                      className="w-full text-left px-4 py-3 flex items-center justify-between"
                      style={{ background: "transparent" }}
                    >
                      <span>
                        <span className="font-mono text-xs mr-2" style={{ color: "var(--muted)" }}>
                          {String(sIdx + 1).padStart(2, "0")}
                        </span>
                        <span className="font-display text-sm font-semibold" style={{ color: "var(--text)" }}>
                          {sec.title}
                        </span>
                      </span>
                      <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                        {open ? "−" : "+"}
                      </span>
                    </button>
                    {open && (
                      <ul style={{ background: "var(--surface-2)" }}>
                        {sec.lessons.map((l, lIdx) => {
                          const g = globalIndex(sIdx, lIdx);
                          const isActive = selected.section === sIdx && selected.lesson === lIdx;
                          const isDone = !!progress[g];
                          return (
                            <li key={lIdx}>
                              <button
                                onClick={() => setSelected({ section: sIdx, lesson: lIdx })}
                                className="w-full text-left px-4 py-2 flex items-center gap-3 font-mono text-xs"
                                style={{
                                  color: isActive ? "var(--accent)" : "var(--muted)",
                                  borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                                }}
                              >
                                <span style={{ color: isDone ? "var(--accent)" : "var(--muted-2)" }}>
                                  {isDone ? "✓" : "○"}
                                </span>
                                <span>{l.title}</span>
                              </button>
                            </li>
                          );
                        })}
                        {sec.lessons.length === 0 && (
                          <li className="px-4 py-2 text-xs italic" style={{ color: "var(--muted-2)" }}>
                            No lessons in this section.
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>
          )}
        </aside>

        {/* Lesson view */}
        <article className="lg:col-span-8">
          {!selectedLesson ? (
            <div className="card p-8 text-center">
              <p className="eyebrow mb-2">No lessons</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                This course has no published content yet.
              </p>
            </div>
          ) : (
            <div className="card p-8">
              <p className="eyebrow mb-2">
                Section {selected.section + 1} · Lesson {selected.lesson + 1}
              </p>
              <h2 className="font-display font-bold tracking-[-0.01em] mb-4" style={{ fontSize: "2rem", color: "var(--text)" }}>
                {selectedLesson.title}
              </h2>
              <div
                className="text-base leading-[1.75] whitespace-pre-wrap"
                style={{ color: "var(--muted)", fontFamily: "'Inter', system-ui, sans-serif" }}
              >
                {selectedLesson.content || (
                  <span className="italic" style={{ color: "var(--muted-2)" }}>This lesson has no content yet.</span>
                )}
              </div>

              <div
                className="mt-8 pt-6 flex flex-wrap items-center justify-between gap-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <button
                  onClick={() => toggleLessonComplete(selected.section, selected.lesson)}
                  className="btn"
                  style={
                    selectedDone
                      ? { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "var(--accent)" }
                      : undefined
                  }
                >
                  {selectedDone ? "✓ Marked complete" : "Mark complete"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const flatIdx = flatLessons.findIndex(
                        (x) => x.sIdx === selected.section && x.lIdx === selected.lesson
                      );
                      const prev = flatLessons[flatIdx - 1];
                      if (prev) {
                        setSelected({ section: prev.sIdx, lesson: prev.lIdx });
                        setExpandedSection(prev.sIdx);
                      }
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => {
                      const flatIdx = flatLessons.findIndex(
                        (x) => x.sIdx === selected.section && x.lIdx === selected.lesson
                      );
                      const next = flatLessons[flatIdx + 1];
                      if (next) {
                        setSelected({ section: next.sIdx, lesson: next.lIdx });
                        setExpandedSection(next.sIdx);
                      }
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Completion CTA */}
          {enrolled && allDone && !completed && (
            <div className="card p-6 mt-6" style={{ borderColor: "var(--accent)" }}>
              <p className="eyebrow mb-2" style={{ color: "var(--accent)" }}>All lessons complete</p>
              <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                Ready to finish? Ask the instructor to mark you complete on chain. The instructor
                wallet ({shortInstructor}) can trigger this from their wallet:
              </p>
              <button
                onClick={handleCompleteCourse}
                disabled={actionPending === "complete" || account?.toLowerCase() !== course.instructor.toLowerCase()}
                className="btn btn-primary"
              >
                {actionPending === "complete" ? "Submitting…" : "Mark course complete (instructor)"}
              </button>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}
