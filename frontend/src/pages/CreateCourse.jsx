import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { uploadJSON } from "../utils/ipfs";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../utils/contracts";

function makeReadRegistry() {
  const provider = new ethers.JsonRpcProvider(
    `${window.location.origin}/rpc`,
    { chainId: 31337, name: "hardhat" },
    { staticNetwork: true }
  );
  return new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);
}

const emptyLesson = () => ({ title: "", content: "" });
const emptySection = () => ({ title: "", lessons: [emptyLesson()] });

function Stepper({ step }) {
  const labels = ["Course Info", "Content", "Review & Publish"];
  return (
    <div className="grid grid-cols-3 gap-px mb-10" style={{ background: "var(--border)" }}>
      {labels.map((l, i) => {
        const active = i + 1 === step;
        const done = i + 1 < step;
        return (
          <div
            key={l}
            className="px-5 py-4"
            style={{
              background: active ? "var(--accent)" : "var(--surface)",
              color: active ? "var(--accent-ink)" : done ? "var(--text)" : "var(--muted)",
            }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.16em] mb-1">
              Step 0{i + 1}
            </p>
            <p className="font-display font-semibold text-sm">{l}</p>
          </div>
        );
      })}
    </div>
  );
}

export function CreateCourse({ account, connect, courseRegistry }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceEth, setPriceEth] = useState("");

  const [sections, setSections] = useState([emptySection()]);

  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(null); // { phase, current, total, label }
  const [error, setError] = useState(null);

  if (!account) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="eyebrow mb-3">Restricted</p>
        <h1 className="font-display font-semibold text-3xl mb-3" style={{ color: "var(--text)" }}>
          Connect your wallet.
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
          Publishing a course writes to chain. You need a wallet to sign.
        </p>
        <button onClick={connect} className="btn btn-primary btn-lg">
          Connect Wallet
        </button>
      </main>
    );
  }

  // ── Section/Lesson helpers ────────────────────────────────────────────
  function addSection() {
    setSections((s) => [...s, emptySection()]);
  }
  function removeSection(idx) {
    setSections((s) => s.filter((_, i) => i !== idx));
  }
  function moveSection(idx, dir) {
    setSections((s) => {
      const j = idx + dir;
      if (j < 0 || j >= s.length) return s;
      const next = s.slice();
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function updateSectionTitle(idx, value) {
    setSections((s) => s.map((sec, i) => (i === idx ? { ...sec, title: value } : sec)));
  }
  function addLesson(secIdx) {
    setSections((s) =>
      s.map((sec, i) => (i === secIdx ? { ...sec, lessons: [...sec.lessons, emptyLesson()] } : sec))
    );
  }
  function removeLesson(secIdx, lessonIdx) {
    setSections((s) =>
      s.map((sec, i) =>
        i === secIdx ? { ...sec, lessons: sec.lessons.filter((_, j) => j !== lessonIdx) } : sec
      )
    );
  }
  function moveLesson(secIdx, lessonIdx, dir) {
    setSections((s) =>
      s.map((sec, i) => {
        if (i !== secIdx) return sec;
        const j = lessonIdx + dir;
        if (j < 0 || j >= sec.lessons.length) return sec;
        const arr = sec.lessons.slice();
        [arr[lessonIdx], arr[j]] = [arr[j], arr[lessonIdx]];
        return { ...sec, lessons: arr };
      })
    );
  }
  function updateLesson(secIdx, lessonIdx, key, value) {
    setSections((s) =>
      s.map((sec, i) =>
        i === secIdx
          ? {
              ...sec,
              lessons: sec.lessons.map((l, j) => (j === lessonIdx ? { ...l, [key]: value } : l)),
            }
          : sec
      )
    );
  }

  // ── Publish flow ──────────────────────────────────────────────────────
  async function publish() {
    if (!courseRegistry) return;
    setError(null);
    setPublishing(true);
    setProgress({ phase: "init", label: "Preparing publication…" });

    try {
      const walletProvider = courseRegistry.runner?.provider;
      const net = await walletProvider.getNetwork();
      if (net.chainId !== 31337n) {
        throw new Error(
          `MetaMask is on chain ${net.chainId}; switch to chain 31337 (RPC http://localhost:8545).`
        );
      }

      const readRegistry = makeReadRegistry();
      const before = await readRegistry.courseCount();

      setProgress({ phase: "ipfs", label: "Uploading metadata…" });
      const ipfsHash = await uploadJSON({ title, description });
      const priceWei = ethers.parseEther(priceEth || "0");

      setProgress({ phase: "course", label: "Creating course on-chain…" });
      const tx = await courseRegistry.createCourse(ipfsHash, priceWei);
      await tx.wait();

      const after = await readRegistry.courseCount();
      if (!(after > before)) {
        throw new Error(
          "Transaction mined but course count did not change. MetaMask may be on a different node."
        );
      }
      const courseId = Number(after);

      const validSections = sections
        .map((s) => ({
          title: s.title.trim(),
          lessons: s.lessons
            .map((l) => ({ title: l.title.trim(), content: l.content.trim() }))
            .filter((l) => l.title.length > 0),
        }))
        .filter((s) => s.title.length > 0);

      for (let i = 0; i < validSections.length; i++) {
        setProgress({
          phase: "sections",
          current: i + 1,
          total: validSections.length,
          label: `Adding section ${i + 1}/${validSections.length}…`,
        });
        const sTx = await courseRegistry.addSection(courseId, validSections[i].title);
        await sTx.wait();
      }

      let lessonTotal = validSections.reduce((acc, s) => acc + s.lessons.length, 0);
      let lessonDone = 0;
      for (let i = 0; i < validSections.length; i++) {
        for (let j = 0; j < validSections[i].lessons.length; j++) {
          lessonDone++;
          setProgress({
            phase: "lessons",
            current: lessonDone,
            total: lessonTotal,
            label: `Adding lesson ${lessonDone}/${lessonTotal}…`,
          });
          const l = validSections[i].lessons[j];
          const lTx = await courseRegistry.addLesson(courseId, i, l.title, l.content);
          await lTx.wait();
        }
      }

      setProgress({ phase: "done", label: "Published. Opening course…" });
      setTimeout(() => navigate(`/courses/${courseId}`), 800);
    } catch (err) {
      console.error(err);
      let msg = err.reason || err.shortMessage || err.message || String(err);
      if (/nonce/i.test(msg)) {
        msg += "  —  Reset MetaMask account activity (Settings → Advanced → Clear activity).";
      }
      setError(msg);
      setProgress(null);
    } finally {
      setPublishing(false);
    }
  }

  // ── Step 1 — Info ─────────────────────────────────────────────────────
  if (step === 1) {
    const canNext = title.trim() && description.trim() && priceEth !== "";
    return (
      <main className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-10">
          <p className="eyebrow mb-2">— Publish a Course</p>
          <h1 className="font-display font-bold text-4xl tracking-[-0.02em]" style={{ color: "var(--text)" }}>
            Course Info
          </h1>
        </header>

        <Stepper step={1} />

        <div className="card p-6 flex flex-col gap-6">
          <div>
            <label className="label block mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Solidity for Beginners"
              className="input"
            />
          </div>
          <div>
            <label className="label block mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="What will students learn?"
              className="input"
              style={{ resize: "vertical" }}
            />
          </div>
          <div>
            <label className="label block mb-2">Price (ETH) — 0 for free</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={priceEth}
              onChange={(e) => setPriceEth(e.target.value)}
              placeholder="0.05"
              className="input"
            />
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} disabled={!canNext} className="btn btn-primary btn-lg">
              Next →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Step 2 — Content ──────────────────────────────────────────────────
  if (step === 2) {
    const hasContent = sections.some((s) => s.title.trim() && s.lessons.some((l) => l.title.trim()));
    return (
      <main className="max-w-[1440px] mx-auto px-6 py-12">
        <header className="mb-10">
          <p className="eyebrow mb-2">— Publish a Course</p>
          <h1 className="font-display font-bold text-4xl tracking-[-0.02em]" style={{ color: "var(--text)" }}>
            Build the syllabus
          </h1>
        </header>

        <Stepper step={2} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Builder */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {sections.map((sec, sIdx) => (
              <div key={sIdx} className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                    Section {sIdx + 1}
                  </span>
                  <div className="flex-1" />
                  <button onClick={() => moveSection(sIdx, -1)} className="btn btn-ghost btn-sm" disabled={sIdx === 0}>↑</button>
                  <button onClick={() => moveSection(sIdx, 1)} className="btn btn-ghost btn-sm" disabled={sIdx === sections.length - 1}>↓</button>
                  <button onClick={() => removeSection(sIdx)} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>Remove</button>
                </div>
                <input
                  type="text"
                  value={sec.title}
                  onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                  placeholder="Section title…"
                  className="input mb-4"
                />
                <div className="flex flex-col gap-3">
                  {sec.lessons.map((l, lIdx) => (
                    <div
                      key={lIdx}
                      className="p-4"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                          Lesson {lIdx + 1}
                        </span>
                        <div className="flex-1" />
                        <button onClick={() => moveLesson(sIdx, lIdx, -1)} className="btn btn-ghost btn-sm" disabled={lIdx === 0}>↑</button>
                        <button onClick={() => moveLesson(sIdx, lIdx, 1)} className="btn btn-ghost btn-sm" disabled={lIdx === sec.lessons.length - 1}>↓</button>
                        <button onClick={() => removeLesson(sIdx, lIdx)} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>Remove</button>
                      </div>
                      <input
                        type="text"
                        value={l.title}
                        onChange={(e) => updateLesson(sIdx, lIdx, "title", e.target.value)}
                        placeholder="Lesson title…"
                        className="input mb-2"
                      />
                      <textarea
                        value={l.content}
                        onChange={(e) => updateLesson(sIdx, lIdx, "content", e.target.value)}
                        rows={4}
                        placeholder="Lesson content (plain text)…"
                        className="input"
                        style={{ resize: "vertical" }}
                      />
                    </div>
                  ))}
                  <button onClick={() => addLesson(sIdx)} className="btn btn-outline btn-sm self-start">
                    + Add lesson
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addSection} className="btn btn-outline self-start">
              + Add section
            </button>
          </div>

          {/* Preview */}
          <aside className="lg:col-span-4">
            <div className="card p-5 sticky top-20">
              <p className="eyebrow mb-3">Outline preview</p>
              <h3 className="font-display font-semibold text-lg mb-3" style={{ color: "var(--text)" }}>
                {title || "Untitled course"}
              </h3>
              {sections.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>No content yet.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {sections.map((s, i) => (
                    <li key={i}>
                      <p className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </p>
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
                        {s.title || "Untitled section"}
                      </p>
                      <ul className="ml-3 text-xs" style={{ color: "var(--muted)" }}>
                        {s.lessons.filter((l) => l.title.trim()).map((l, j) => (
                          <li key={j}>· {l.title}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>

        <div className="flex justify-between mt-8">
          <button onClick={() => setStep(1)} className="btn btn-outline">← Back</button>
          <button onClick={() => setStep(3)} disabled={!hasContent} className="btn btn-primary btn-lg">
            Review →
          </button>
        </div>
      </main>
    );
  }

  // ── Step 3 — Review/Publish ──────────────────────────────────────────
  const totalSections = sections.filter((s) => s.title.trim()).length;
  const totalLessons = sections.reduce(
    (acc, s) => acc + (s.title.trim() ? s.lessons.filter((l) => l.title.trim()).length : 0),
    0
  );

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <header className="mb-10">
        <p className="eyebrow mb-2">— Publish a Course</p>
        <h1 className="font-display font-bold text-4xl tracking-[-0.02em]" style={{ color: "var(--text)" }}>
          Review & Publish
        </h1>
      </header>

      <Stepper step={3} />

      <div className="card p-4 mb-4" style={{ background: "var(--surface-2)" }}>
        <p className="eyebrow mb-1">Transactions required</p>
        <p className="font-mono text-sm" style={{ color: "var(--text)" }}>
          {1 + totalSections + totalLessons} ·{" "}
          <span style={{ color: "var(--muted)" }}>
            1 create + {totalSections} section{totalSections === 1 ? "" : "s"} + {totalLessons} lesson{totalLessons === 1 ? "" : "s"}
          </span>
        </p>
      </div>

      <div className="card p-6 mb-6 flex flex-col gap-4">
        <div>
          <p className="eyebrow mb-1">Title</p>
          <p className="font-display text-xl" style={{ color: "var(--text)" }}>{title}</p>
        </div>
        <div>
          <p className="eyebrow mb-1">Description</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--muted)" }}>{description}</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="eyebrow mb-1">Price</p>
            <p className="font-mono text-base" style={{ color: "var(--text)" }}>
              {priceEth === "0" || priceEth === "" ? "FREE" : `${priceEth} ETH`}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-1">Sections</p>
            <p className="font-mono text-base" style={{ color: "var(--text)" }}>{totalSections}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Lessons</p>
            <p className="font-mono text-base" style={{ color: "var(--text)" }}>{totalLessons}</p>
          </div>
        </div>
      </div>

      {progress && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 animate-spin"
              style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }}
            />
            <p className="font-mono text-sm" style={{ color: "var(--text)" }}>{progress.label}</p>
          </div>
          {progress.total != null && (
            <div className="mt-3 h-1" style={{ background: "var(--border)" }}>
              <div
                className="h-1"
                style={{
                  background: "var(--accent)",
                  width: `${(progress.current / progress.total) * 100}%`,
                  transition: "width 200ms ease",
                }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="card p-4 mb-6" style={{ borderColor: "var(--danger)" }}>
          <p className="font-mono text-xs uppercase tracking-[0.18em] mb-1" style={{ color: "var(--danger)" }}>Error</p>
          <p className="text-sm break-words" style={{ color: "var(--text)" }}>{error}</p>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={() => setStep(2)} disabled={publishing} className="btn btn-outline">← Back</button>
        <button onClick={publish} disabled={publishing} className="btn btn-primary btn-lg">
          {publishing ? "Publishing…" : "Publish Course"}
        </button>
      </div>
    </main>
  );
}
