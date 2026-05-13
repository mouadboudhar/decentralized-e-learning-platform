import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { ipfsToHttp } from "../utils/ipfs";
import { sanitizeHTML } from "../utils/sanitize";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../utils/contracts";

function makeReadProvider() {
  return new ethers.JsonRpcProvider(
    `${window.location.origin}/rpc`,
    { chainId: 31337, name: "hardhat" },
    { staticNetwork: true }
  );
}

function progressKey(account, courseId, moduleIndex, lessonIndex) {
  return `learnchain_progress_${account ?? "guest"}_${courseId}_${moduleIndex}_${lessonIndex}`;
}

function flatLessons(modules) {
  const out = [];
  modules.forEach((m, mi) => {
    m.lessons.forEach((l, li) => out.push({ moduleIndex: mi, lessonIndex: li, lesson: l, module: m }));
  });
  return out;
}

function CompletionMark({ done }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 14,
        height: 14,
        border: `1px solid ${done ? "var(--accent)" : "var(--muted-2)"}`,
        background: done ? "var(--accent)" : "transparent",
        color: done ? "var(--accent-ink)" : "transparent",
        borderRadius: "50%",
        fontSize: 10,
        lineHeight: 1,
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      ✓
    </span>
  );
}

export function CourseDetail({ account, courseRegistry, connect }) {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]); // [{ title, description, lessons: [{ title, contentIpfsHash, contentHash, estimatedMinutes }] }]
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [enrolled, setEnrolled] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState({ moduleIndex: 0, lessonIndex: 0 });
  const [expanded, setExpanded] = useState({}); // moduleIndex -> bool
  const [progress, setProgress] = useState({}); // "mi_li" -> bool

  const [lessonHTML, setLessonHTML] = useState("");
  const [lessonLoading, setLessonLoading] = useState(false);
  const [integrityOK, setIntegrityOK] = useState(true);
  const [lessonError, setLessonError] = useState(null);

  const [actionPending, setActionPending] = useState(null);

  const readContract = useMemo(
    () => new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, makeReadProvider()),
    []
  );

  const lessons = useMemo(() => flatLessons(modules), [modules]);

  const completedCount = useMemo(() => {
    let c = 0;
    for (const { moduleIndex, lessonIndex } of lessons) {
      if (progress[`${moduleIndex}_${lessonIndex}`]) c++;
    }
    return c;
  }, [progress, lessons]);

  const moduleProgress = useCallback(
    (mi) => {
      const mod = modules[mi];
      if (!mod) return { done: 0, total: 0 };
      let done = 0;
      mod.lessons.forEach((_, li) => {
        if (progress[`${mi}_${li}`]) done++;
      });
      return { done, total: mod.lessons.length };
    },
    [modules, progress]
  );

  // Lock module N+1 until all lessons in module N are done.
  const isModuleLocked = useCallback(
    (mi) => {
      if (mi === 0) return false;
      const prev = moduleProgress(mi - 1);
      return prev.total > 0 && prev.done < prev.total;
    },
    [moduleProgress]
  );

  const loadProgress = useCallback(
    (mods) => {
      const next = {};
      mods.forEach((m, mi) => {
        m.lessons.forEach((_, li) => {
          if (localStorage.getItem(progressKey(account, courseId, mi, li)) === "1") {
            next[`${mi}_${li}`] = true;
          }
        });
      });
      setProgress(next);
    },
    [account, courseId]
  );

  // ── Load course/modules/lessons (metadata only — content fetched lazily) ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const c = await readContract.courses(courseId);
        if (!c || Number(c.id) === 0) throw new Error("Course not found.");

        let meta = { title: `Course #${courseId}`, description: "", thumbnail: "", difficulty: "", estimatedHours: 0, tags: [] };
        try {
          const r = await fetch(ipfsToHttp(c.ipfsHash));
          if (r.ok) {
            const j = await r.json();
            meta = { ...meta, ...j };
          }
        } catch { /* metadata best-effort */ }

        const moduleCount = Number(await readContract.getModuleCount(courseId));
        const mods = [];
        for (let mi = 0; mi < moduleCount; mi++) {
          const m = await readContract.getModule(courseId, mi);
          const lessonCount = Number(await readContract.getLessonCount(courseId, mi));
          const lessons = [];
          for (let li = 0; li < lessonCount; li++) {
            const l = await readContract.getLesson(courseId, mi, li);
            lessons.push({
              title: l.title,
              contentIpfsHash: l.contentIpfsHash,
              contentHash: l.contentHash,
              estimatedMinutes: Number(l.estimatedMinutes),
            });
          }
          mods.push({ title: m.title, description: m.description, lessons });
        }

        let isEnrolled = false;
        let isCompleted = false;
        if (account) {
          isEnrolled = await readContract.isEnrolled(courseId, account);
          isCompleted = await readContract.isCompleted(courseId, account);
        }

        let enrolledCt = 0;
        try {
          const evs = await readContract.queryFilter(readContract.filters.StudentEnrolled(courseId));
          enrolledCt = evs.length;
        } catch { /* best-effort */ }

        if (cancelled) return;

        setCourse({
          instructor: c.instructor,
          ipfsHash: c.ipfsHash,
          price: c.price,
          ...meta,
        });
        setModules(mods);
        setEnrolledCount(enrolledCt);
        setEnrolled(isEnrolled);
        setCompleted(isCompleted);
        loadProgress(mods);
        if (mods.length > 0 && mods[0].lessons.length > 0) {
          setSelected({ moduleIndex: 0, lessonIndex: 0 });
          setExpanded({ 0: true });
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

  // ── Lazy-fetch lesson content + verify integrity ─────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchSelected() {
      const mod = modules[selected.moduleIndex];
      const lesson = mod?.lessons[selected.lessonIndex];
      if (!lesson) {
        setLessonHTML("");
        return;
      }
      setLessonLoading(true);
      setLessonError(null);
      setIntegrityOK(true);
      try {
        const cid = lesson.contentIpfsHash;
        if (!cid) {
          setLessonHTML("");
          return;
        }
        // Fetch the raw payload to compute the keccak256 against on-chain
        // contentHash. We then sanitize a second time before rendering.
        const res = await fetch(ipfsToHttp(cid));
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const raw = await res.text();

        // The on-chain hash was computed over the sanitizeForStorage-canonical
        // form. To verify, we sanitize-for-storage the raw payload and hash.
        // We can't import sanitizeForStorage here without a cycle, so we do
        // sanitizeHTML + the same trimming the storage helper applies.
        const sanitized = sanitizeHTML(raw)
          .replace(/<!--[\s\S]*?-->/g, "")
          .trim();
        const computed = ethers.keccak256(ethers.toUtf8Bytes(sanitized));
        const matches = computed.toLowerCase() === String(lesson.contentHash).toLowerCase();
        if (cancelled) return;
        setIntegrityOK(matches);
        setLessonHTML(sanitized);
      } catch (err) {
        console.error("lesson fetch:", err);
        if (!cancelled) {
          setLessonError(err.message || "Failed to load lesson.");
          setLessonHTML("");
        }
      } finally {
        if (!cancelled) setLessonLoading(false);
      }
    }
    fetchSelected();
    return () => { cancelled = true; };
  }, [modules, selected]);

  const handleEnroll = async () => {
    if (!courseRegistry) { connect?.(); return; }
    setActionPending("enroll");
    try {
      const tx = await courseRegistry.enroll(courseId, { value: course.price });
      await tx.wait();
      setEnrolled(true);
      setEnrolledCount((c) => c + 1);
    } catch (err) {
      alert(err.reason || err.shortMessage || err.message);
    } finally {
      setActionPending(null);
    }
  };

  const toggleComplete = (mi, li) => {
    const key = progressKey(account, courseId, mi, li);
    setProgress((p) => {
      const k = `${mi}_${li}`;
      const next = { ...p };
      if (next[k]) {
        delete next[k];
        localStorage.removeItem(key);
      } else {
        next[k] = true;
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
      navigate("/certificates");
    } catch (err) {
      alert(err.reason || err.shortMessage || err.message);
    } finally {
      setActionPending(null);
    }
  };

  const goToLesson = (mi, li) => {
    if (isModuleLocked(mi)) return;
    setSelected({ moduleIndex: mi, lessonIndex: li });
    setExpanded((e) => ({ ...e, [mi]: true }));
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

  const totalLessonsCount = lessons.length;
  const totalMinutes = lessons.reduce((a, l) => a + (l.lesson.estimatedMinutes || 0), 0);
  const totalHours = Math.max(1, Math.round(totalMinutes / 60));

  const allDone = totalLessonsCount > 0 && completedCount === totalLessonsCount;

  const selectedMod = modules[selected.moduleIndex];
  const selectedLesson = selectedMod?.lessons[selected.lessonIndex];
  const selectedDone = !!progress[`${selected.moduleIndex}_${selected.lessonIndex}`];

  // Prev/Next that respect module locks
  const flatIdx = lessons.findIndex(
    (x) => x.moduleIndex === selected.moduleIndex && x.lessonIndex === selected.lessonIndex
  );
  const prev = flatIdx > 0 ? lessons[flatIdx - 1] : null;
  const next = flatIdx < lessons.length - 1 ? lessons[flatIdx + 1] : null;
  const nextLocked = next ? isModuleLocked(next.moduleIndex) : false;

  return (
    <div>
      {/* Course Header */}
      <header
        className="max-w-[1440px] mx-auto px-6 py-8"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <p className="eyebrow mb-2">— Course № {String(courseId).padStart(3, "0")}</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1
              className="font-display font-bold tracking-[-0.02em] leading-tight"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", color: "var(--text)" }}
            >
              {course.title}
            </h1>
            {course.description && (
              <p className="text-sm mt-3 max-w-2xl" style={{ color: "var(--muted)" }}>
                {course.description}
              </p>
            )}
            <div
              className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-[0.16em]"
              style={{ color: "var(--muted)" }}
            >
              <span>By {shortInstructor}</span>
              <span style={{ color: free ? "var(--accent)" : "var(--text)" }}>
                {free ? "FREE" : `${priceEth} ETH`}
              </span>
              <span>{enrolledCount} enrolled</span>
              <span>{modules.length} modules</span>
              <span>{totalLessonsCount} lessons</span>
              <span>~{totalHours}h</span>
              {course.difficulty && <span style={{ color: "var(--text)" }}>{course.difficulty}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {!account && (
              <button onClick={connect} className="btn btn-primary">Connect Wallet</button>
            )}
            {account && !enrolled && (
              <button onClick={handleEnroll} disabled={actionPending === "enroll"} className="btn btn-primary btn-lg">
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
              <Link
                to="/certificates"
                className="font-mono text-xs uppercase tracking-[0.18em] px-3 py-2"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                ✓ Completed → Certificates
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr]" style={{ minHeight: "70vh" }}>
        {/* Sidebar */}
        <aside
          className="lg:sticky lg:top-16 self-start p-4 lg:p-5 lg:h-[calc(100vh-64px)] lg:overflow-y-auto"
          style={{ borderRight: "1px solid var(--border)" }}
        >
          <p className="eyebrow mb-2">Syllabus</p>
          <p
            className="font-display font-semibold mb-3 leading-tight"
            style={{ color: "var(--text)", fontSize: "1.05rem" }}
          >
            {course.title}
          </p>

          {totalLessonsCount > 0 && (
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="eyebrow">Progress</span>
                <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                  {Math.round((completedCount / totalLessonsCount) * 100)}%
                </span>
              </div>
              <div className="h-1" style={{ background: "var(--border)" }}>
                <div
                  className="h-1"
                  style={{
                    background: "var(--accent)",
                    width: `${(completedCount / totalLessonsCount) * 100}%`,
                    transition: "width 200ms ease",
                  }}
                />
              </div>
              <p className="font-mono text-xs mt-1" style={{ color: "var(--muted)" }}>
                {completedCount} of {totalLessonsCount} lessons
              </p>
            </div>
          )}

          {modules.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No content yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-1">
              {modules.map((m, mi) => {
                const open = !!expanded[mi];
                const locked = isModuleLocked(mi);
                const mp = moduleProgress(mi);
                const totalMin = m.lessons.reduce((a, l) => a + (l.estimatedMinutes || 0), 0);
                return (
                  <li key={mi}>
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [mi]: !open }))}
                      disabled={locked}
                      className="w-full text-left px-3 py-2"
                      style={{
                        background: open ? "var(--surface-2)" : "transparent",
                        border: "1px solid var(--border)",
                        opacity: locked ? 0.55 : 1,
                        cursor: locked ? "not-allowed" : "pointer",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                            Module {String(mi + 1).padStart(2, "0")}
                            {locked && " · LOCKED 🔒"}
                          </p>
                          <p
                            className="font-display text-sm font-semibold leading-tight"
                            style={{ color: "var(--text)" }}
                          >
                            {m.title}
                          </p>
                        </div>
                        <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                          {open ? "−" : "+"}
                        </span>
                      </div>
                      <p className="font-mono text-xs mt-1" style={{ color: "var(--muted-2)" }}>
                        {mp.done}/{mp.total} · {totalMin}m
                      </p>
                    </button>
                    {open && !locked && (
                      <ul className="mt-1 mb-2 flex flex-col gap-px">
                        {m.lessons.map((l, li) => {
                          const isActive = selected.moduleIndex === mi && selected.lessonIndex === li;
                          const isDone = !!progress[`${mi}_${li}`];
                          return (
                            <li key={li}>
                              <button
                                onClick={() => goToLesson(mi, li)}
                                className="w-full text-left flex items-center gap-2 px-3 py-2"
                                style={{
                                  background: isActive ? "var(--surface-2)" : "transparent",
                                  borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                                  color: isActive ? "var(--text)" : "var(--muted)",
                                }}
                              >
                                <CompletionMark done={isDone} />
                                <span className="text-sm flex-1">{l.title}</span>
                                <span className="font-mono text-xs" style={{ color: "var(--muted-2)" }}>
                                  {l.estimatedMinutes || 0}m
                                </span>
                              </button>
                            </li>
                          );
                        })}
                        {m.lessons.length === 0 && (
                          <li className="px-3 py-2 text-xs italic" style={{ color: "var(--muted-2)" }}>
                            No lessons in this module.
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </aside>

        {/* Main content */}
        <article className="px-6 lg:px-10 py-8 max-w-4xl">
          {!selectedLesson ? (
            <div className="card p-8 text-center">
              <p className="eyebrow mb-2">Empty</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                This course has no published lessons yet.
              </p>
            </div>
          ) : (
            <>
              <nav
                className="font-mono text-xs uppercase tracking-[0.16em] mb-4"
                style={{ color: "var(--muted)" }}
              >
                <Link to="/courses" style={{ color: "var(--muted)" }}>Courses</Link>
                <span> / </span>
                <span>{course.title}</span>
                <span> / </span>
                <span>{selectedMod.title}</span>
                <span> / </span>
                <span style={{ color: "var(--text)" }}>{selectedLesson.title}</span>
              </nav>

              <p className="eyebrow mb-2">
                Module {selected.moduleIndex + 1} · Lesson {selected.lessonIndex + 1}
              </p>
              <h2
                className="font-display font-bold tracking-[-0.01em] mb-2"
                style={{ fontSize: "2.25rem", color: "var(--text)" }}
              >
                {selectedLesson.title}
              </h2>
              <p className="font-mono text-xs mb-6" style={{ color: "var(--muted)" }}>
                ~{selectedLesson.estimatedMinutes || 1} min read
              </p>

              {!integrityOK && (
                <div
                  className="card p-4 mb-6"
                  style={{ borderColor: "var(--danger)", background: "var(--surface)" }}
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em] mb-1" style={{ color: "var(--danger)" }}>
                    ⚠ Content integrity warning
                  </p>
                  <p className="text-sm" style={{ color: "var(--text)" }}>
                    This lesson content could not be verified. The content may have been tampered
                    with. Do not trust external links in this lesson.
                  </p>
                </div>
              )}

              {lessonLoading ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>Loading lesson…</p>
              ) : lessonError ? (
                <p className="text-sm" style={{ color: "var(--danger)" }}>{lessonError}</p>
              ) : lessonHTML ? (
                <div
                  className="prose"
                  // Sanitize again at render time — defense in depth even though
                  // fetchLessonContent already sanitized the IPFS payload.
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(lessonHTML) }}
                />
              ) : (
                <p className="text-sm italic" style={{ color: "var(--muted-2)" }}>
                  This lesson has no content yet.
                </p>
              )}

              <div
                className="mt-10 pt-6 flex flex-wrap items-center justify-between gap-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <button
                  onClick={() => toggleComplete(selected.moduleIndex, selected.lessonIndex)}
                  className="btn"
                  style={
                    selectedDone
                      ? { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "var(--accent)" }
                      : undefined
                  }
                >
                  {selectedDone ? "✓ Completed" : "Mark as Complete"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => prev && goToLesson(prev.moduleIndex, prev.lessonIndex)}
                    disabled={!prev}
                    className="btn btn-ghost btn-sm"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => next && !nextLocked && goToLesson(next.moduleIndex, next.lessonIndex)}
                    disabled={!next || nextLocked}
                    className="btn btn-outline btn-sm"
                    title={nextLocked ? "Next module unlocks after this one is complete" : undefined}
                  >
                    {nextLocked ? "🔒 Next module locked" : "Next →"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Course completion banner */}
          {enrolled && allDone && !completed && (
            <div
              className="card p-6 mt-8"
              style={{ borderColor: "var(--accent)", background: "var(--surface)" }}
            >
              <p className="eyebrow mb-2" style={{ color: "var(--accent)" }}>
                All lessons complete
              </p>
              <h3 className="font-display text-2xl mb-2" style={{ color: "var(--text)" }}>
                Earn your certificate.
              </h3>
              <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                Once the instructor marks you complete on chain, a soulbound NFT certificate is
                minted to your wallet.
                {account?.toLowerCase() === course.instructor.toLowerCase()
                  ? " You are the instructor — you can issue the completion now."
                  : ""}
              </p>
              <button
                onClick={handleCompleteCourse}
                disabled={
                  actionPending === "complete" ||
                  account?.toLowerCase() !== course.instructor.toLowerCase()
                }
                className="btn btn-primary"
              >
                {actionPending === "complete" ? "Submitting…" : "Complete Course and Earn Certificate"}
              </button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
