import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { ipfsToHttp, uploadLessonContent } from "../utils/ipfs";
import { sanitizeForStorage } from "../utils/sanitize";
import { Editor } from "../components/Editor";
import {
  COURSE_REGISTRY_ADDRESS,
  COURSE_REGISTRY_ABI,
} from "../utils/contracts";

function makeReadProvider() {
  return new ethers.JsonRpcProvider(
    `${window.location.origin}/rpc`,
    { chainId: 31337, name: "hardhat" },
    { staticNetwork: true }
  );
}

async function fetchTitle(ipfsHash, fallback) {
  try {
    const res = await fetch(ipfsToHttp(ipfsHash));
    if (!res.ok) return fallback;
    const data = await res.json();
    return typeof data.title === "string" ? data.title : fallback;
  } catch {
    return fallback;
  }
}

function StatCard({ label, value }) {
  return (
    <div className="p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="eyebrow mb-2">{label}</p>
      <p className="font-mono text-3xl" style={{ color: "var(--text)" }}>{value}</p>
    </div>
  );
}

function InstructorCourseRow({ course, courseRegistry }) {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState([]); // [{ title, description, lessonCount }]

  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");

  // lessonForms[mi] = { title, minutes, html }
  const [lessonForms, setLessonForms] = useState({});

  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);

  const readReg = useMemo(
    () => new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, makeReadProvider()),
    []
  );

  const reload = useCallback(async () => {
    try {
      const count = Number(await readReg.getModuleCount(course.id));
      const out = [];
      for (let i = 0; i < count; i++) {
        const m = await readReg.getModule(course.id, i);
        out.push({
          title: m.title,
          description: m.description,
          lessonCount: Number(m.lessonCount),
        });
      }
      setModules(out);
    } catch (err) {
      console.error(err);
    }
  }, [readReg, course.id]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!moduleTitle.trim()) return;
    setPending("module");
    setError(null);
    try {
      const tx = await courseRegistry.addModule(course.id, moduleTitle.trim(), moduleDescription.trim());
      await tx.wait();
      setModuleTitle("");
      setModuleDescription("");
      await reload();
    } catch (err) {
      setError(err.reason || err.shortMessage || err.message);
    } finally {
      setPending(null);
    }
  };

  const updateLessonForm = (mi, patch) => {
    setLessonForms((s) => ({
      ...s,
      [mi]: { title: "", minutes: 5, html: "", ...(s[mi] || {}), ...patch },
    }));
  };

  const handleAddLesson = async (mi, e) => {
    e.preventDefault();
    const form = lessonForms[mi] || { title: "", minutes: 5, html: "" };
    if (!form.title.trim()) return;
    setPending(`lesson-${mi}`);
    setError(null);
    try {
      // Same sanitize → IPFS → keccak256 pipeline as CreateCourse publish.
      const clean = sanitizeForStorage(form.html || "");
      const cid = await uploadLessonContent(clean);
      const hash = ethers.keccak256(ethers.toUtf8Bytes(clean));
      const minutes = Math.max(0, Number(form.minutes) || 0);

      const tx = await courseRegistry.addLesson(
        course.id,
        mi,
        form.title.trim(),
        cid,
        hash,
        minutes
      );
      await tx.wait();
      setLessonForms((s) => ({ ...s, [mi]: { title: "", minutes: 5, html: "" } }));
      await reload();
    } catch (err) {
      setError(err.reason || err.shortMessage || err.message);
    } finally {
      setPending(null);
    }
  };

  const priceEth = ethers.formatEther(course.price.toString());
  const free = priceEth === "0.0";

  return (
    <div className="card">
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: open ? "1px solid var(--border)" : "none" }}>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
            № {String(course.id).padStart(3, "0")}
          </span>
          <span className="font-display font-semibold" style={{ color: "var(--text)" }}>
            {course.title}
          </span>
          <span className="font-mono text-xs" style={{ color: free ? "var(--accent)" : "var(--muted)" }}>
            {free ? "FREE" : `${priceEth} ETH`}
          </span>
        </div>
        <div className="flex gap-2">
          <Link to={`/courses/${course.id}`} className="btn btn-ghost btn-sm">View</Link>
          <button onClick={() => setOpen((o) => !o)} className="btn btn-outline btn-sm">
            {open ? "Close" : "Manage"}
          </button>
        </div>
      </div>

      {open && (
        <div className="p-5 flex flex-col gap-6">
          {/* Add module */}
          <form onSubmit={handleAddModule} className="flex flex-col gap-2">
            <p className="eyebrow">Add module</p>
            <input
              type="text"
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
              placeholder="Module title"
              className="input"
            />
            <textarea
              value={moduleDescription}
              onChange={(e) => setModuleDescription(e.target.value)}
              placeholder="Module description (optional)"
              rows={2}
              className="input"
              style={{ resize: "vertical" }}
            />
            <button
              type="submit"
              disabled={pending === "module" || !courseRegistry || !moduleTitle.trim()}
              className="btn btn-primary btn-sm self-start"
            >
              {pending === "module" ? "Adding…" : "+ Add module"}
            </button>
          </form>

          {modules.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>No modules yet.</p>
          ) : (
            <ol className="flex flex-col gap-5">
              {modules.map((mod, mi) => (
                <li key={mi} className="p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <div className="flex items-baseline justify-between mb-3">
                    <div>
                      <span className="font-mono text-xs mr-2" style={{ color: "var(--muted)" }}>
                        M{String(mi + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display font-semibold" style={{ color: "var(--text)" }}>
                        {mod.title}
                      </span>
                    </div>
                    <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                      {mod.lessonCount} lesson{mod.lessonCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  {mod.description && (
                    <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>{mod.description}</p>
                  )}

                  <form onSubmit={(e) => handleAddLesson(mi, e)} className="flex flex-col gap-2">
                    <p className="eyebrow">Add lesson</p>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                      <input
                        type="text"
                        value={lessonForms[mi]?.title || ""}
                        onChange={(e) => updateLessonForm(mi, { title: e.target.value })}
                        placeholder="Lesson title"
                        className="input"
                      />
                      <input
                        type="number"
                        min="0"
                        value={lessonForms[mi]?.minutes ?? 5}
                        onChange={(e) => updateLessonForm(mi, { minutes: e.target.value })}
                        placeholder="Minutes"
                        className="input"
                      />
                    </div>
                    <Editor
                      content={lessonForms[mi]?.html || ""}
                      onChange={(html) => updateLessonForm(mi, { html })}
                      placeholder="Write the lesson…"
                    />
                    <button
                      type="submit"
                      disabled={pending === `lesson-${mi}` || !courseRegistry || !(lessonForms[mi]?.title || "").trim()}
                      className="btn btn-primary btn-sm self-end"
                    >
                      {pending === `lesson-${mi}` ? "Uploading & adding…" : "+ Add lesson"}
                    </button>
                  </form>
                </li>
              ))}
            </ol>
          )}

          {error && (
            <p className="font-mono text-xs break-words" style={{ color: "var(--danger)" }}>{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function EnrolledCourseRow({ course, account }) {
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);

  const readReg = useMemo(
    () => new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, makeReadProvider()),
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const moduleCount = Number(await readReg.getModuleCount(course.id));
        let totalLessons = 0;
        let done = 0;
        for (let mi = 0; mi < moduleCount; mi++) {
          const lessonCount = Number(await readReg.getLessonCount(course.id, mi));
          totalLessons += lessonCount;
          for (let li = 0; li < lessonCount; li++) {
            if (
              localStorage.getItem(
                `learnchain_progress_${account}_${course.id}_${mi}_${li}`
              ) === "1"
            ) {
              done++;
            }
          }
        }
        if (cancelled) return;
        setTotal(totalLessons);
        setCompleted(done);
      } catch (err) {
        console.error(err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [readReg, course.id, account]);

  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Link
      to={`/courses/${course.id}`}
      className="card card-hoverable p-4 flex items-center gap-4"
    >
      <span className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
        № {String(course.id).padStart(3, "0")}
      </span>
      <span className="font-display font-semibold flex-1" style={{ color: "var(--text)" }}>
        {course.title}
      </span>
      <div className="w-32 h-1" style={{ background: "var(--border)" }}>
        <div className="h-1" style={{ background: "var(--accent)", width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
        {completed}/{total}
      </span>
    </Link>
  );
}

export function Account({ account, connect, courseRegistry, certificateNFT }) {
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [certCount, setCertCount] = useState(0);
  const [myCourses, setMyCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const readReg = useMemo(
    () => new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, makeReadProvider()),
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!account) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [enrolledEvents, completedEvents, createdEvents] = await Promise.all([
          readReg.queryFilter(readReg.filters.StudentEnrolled(null, account)),
          readReg.queryFilter(readReg.filters.CourseCompleted(null, account)),
          readReg.queryFilter(readReg.filters.CourseCreated(null, account)),
        ]);
        if (cancelled) return;
        setEnrolledCount(enrolledEvents.length);
        setCompletedCount(completedEvents.length);

        if (certificateNFT) {
          try {
            const events = await certificateNFT.queryFilter(
              certificateNFT.filters.CertificateMinted(null, account)
            );
            if (!cancelled) setCertCount(events.length);
          } catch (err) {
            console.error("cert count:", err);
          }
        }

        const created = await Promise.all(
          createdEvents.map(async (evt) => {
            const courseId = Number(evt.args[0]);
            const c = await readReg.courses(courseId);
            const title = await fetchTitle(c.ipfsHash, `Course #${courseId}`);
            return {
              id: courseId,
              instructor: c.instructor,
              ipfsHash: c.ipfsHash,
              price: c.price,
              title,
            };
          })
        );
        if (cancelled) return;
        setMyCourses(created.sort((a, b) => b.id - a.id));

        const enrolledRaw = await Promise.all(
          enrolledEvents.map(async (evt) => {
            const courseId = Number(evt.args[0]);
            const c = await readReg.courses(courseId);
            const title = await fetchTitle(c.ipfsHash, `Course #${courseId}`);
            return { id: courseId, title };
          })
        );
        if (!cancelled) setEnrolledCourses(enrolledRaw.sort((a, b) => b.id - a.id));
      } catch (err) {
        console.error("Account load:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [account, readReg, certificateNFT]);

  if (!account) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="eyebrow mb-3">Restricted</p>
        <h1 className="font-display font-semibold text-3xl mb-3" style={{ color: "var(--text)" }}>
          Connect your wallet.
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Your account is your wallet.</p>
        <button onClick={connect} className="btn btn-primary btn-lg">Connect Wallet</button>
      </main>
    );
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="max-w-[1440px] mx-auto px-6 py-12">
      <header className="mb-10" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "1.5rem" }}>
        <p className="eyebrow mb-2">— Account</p>
        <h1 className="font-display font-bold tracking-[-0.02em]" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "var(--text)" }}>
          Your Profile
        </h1>
      </header>

      <section className="mb-12">
        <p className="eyebrow mb-3">Wallet</p>
        <div className="card p-5 flex flex-wrap items-center gap-4">
          <p className="font-mono text-sm break-all flex-1" style={{ color: "var(--text)" }}>{account}</p>
          <button onClick={copyAddress} className="btn btn-outline btn-sm">
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <a
            href={`https://sepolia.etherscan.io/address/${account}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            Etherscan ↗
          </a>
        </div>
      </section>

      <section className="mb-12">
        <p className="eyebrow mb-3">Activity</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Enrolled" value={loading ? "—" : enrolledCount} />
          <StatCard label="Completed" value={loading ? "—" : completedCount} />
          <StatCard label="Certificates" value={loading ? "—" : certCount} />
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-3">
          <p className="eyebrow">Courses you teach</p>
          <Link to="/create" className="btn btn-ghost btn-sm">+ New course</Link>
        </div>
        {loading ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
        ) : myCourses.length === 0 ? (
          <p className="card p-5 text-sm" style={{ color: "var(--muted)" }}>
            You have not published any courses yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {myCourses.map((course) => (
              <InstructorCourseRow
                key={course.id}
                course={course}
                courseRegistry={courseRegistry}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-12">
        <p className="eyebrow mb-3">Enrolled courses</p>
        {loading ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
        ) : enrolledCourses.length === 0 ? (
          <p className="card p-5 text-sm" style={{ color: "var(--muted)" }}>
            You are not enrolled in any courses yet.{" "}
            <Link to="/courses" className="underline" style={{ color: "var(--accent)" }}>
              Browse the catalogue →
            </Link>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {enrolledCourses.map((c) => (
              <EnrolledCourseRow key={c.id} course={c} account={account} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
