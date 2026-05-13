import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { uploadJSON, uploadLessonContent } from "../utils/ipfs";
import { sanitizeForStorage } from "../utils/sanitize";
import { Editor } from "../components/Editor";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../utils/contracts";

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

function makeReadRegistry() {
  const provider = new ethers.JsonRpcProvider(
    `${window.location.origin}/rpc`,
    { chainId: 31337, name: "hardhat" },
    { staticNetwork: true }
  );
  return new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);
}

const newLesson = () => ({ title: "", html: "", minutes: 5 });
const newModule = () => ({ title: "", description: "", lessons: [newLesson()] });

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
            <p className="font-mono text-xs uppercase tracking-[0.16em] mb-1">Step 0{i + 1}</p>
            <p className="font-display font-semibold text-sm">{l}</p>
          </div>
        );
      })}
    </div>
  );
}

function ConfirmInline({ onConfirm, onCancel, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-xs" style={{ color: "var(--danger)" }}>{label}</span>
      <button onClick={onConfirm} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>
        Confirm
      </button>
      <button onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
    </span>
  );
}

export function CreateCourse({ account, connect, courseRegistry }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceEth, setPriceEth] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [hours, setHours] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [thumbnailError, setThumbnailError] = useState("");
  const [tagsError, setTagsError] = useState("");

  // Step 2
  const [modules, setModules] = useState([newModule()]);
  const [confirmRemove, setConfirmRemove] = useState(null); // "module-i" | "lesson-i-j"

  // Step 3
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(null);
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
        <button onClick={connect} className="btn btn-primary btn-lg">Connect Wallet</button>
      </main>
    );
  }

  const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5);

  function validateStep1() {
    let ok = true;
    setThumbnailError("");
    setTagsError("");
    if (thumbnail && !/^https:\/\//i.test(thumbnail.trim())) {
      setThumbnailError("Thumbnail must start with https://");
      ok = false;
    }
    if (tagsStr.split(",").map((t) => t.trim()).filter(Boolean).length > 5) {
      setTagsError("Maximum 5 tags.");
      ok = false;
    }
    return ok;
  }

  // ── Module/lesson helpers ─────────────────────────────────────────────
  const updateModule = (mi, patch) => {
    setModules((s) => s.map((m, i) => (i === mi ? { ...m, ...patch } : m)));
  };
  const updateLesson = (mi, li, patch) => {
    setModules((s) =>
      s.map((m, i) =>
        i === mi
          ? { ...m, lessons: m.lessons.map((l, j) => (j === li ? { ...l, ...patch } : l)) }
          : m
      )
    );
  };
  const addModule = () => setModules((s) => [...s, newModule()]);
  const removeModule = (mi) => setModules((s) => s.filter((_, i) => i !== mi));
  const moveModule = (mi, dir) =>
    setModules((s) => {
      const j = mi + dir;
      if (j < 0 || j >= s.length) return s;
      const next = s.slice();
      [next[mi], next[j]] = [next[j], next[mi]];
      return next;
    });
  const addLesson = (mi) =>
    setModules((s) =>
      s.map((m, i) => (i === mi ? { ...m, lessons: [...m.lessons, newLesson()] } : m))
    );
  const removeLesson = (mi, li) =>
    setModules((s) =>
      s.map((m, i) => (i === mi ? { ...m, lessons: m.lessons.filter((_, j) => j !== li) } : m))
    );
  const moveLesson = (mi, li, dir) =>
    setModules((s) =>
      s.map((m, i) => {
        if (i !== mi) return m;
        const j = li + dir;
        if (j < 0 || j >= m.lessons.length) return m;
        const arr = m.lessons.slice();
        [arr[li], arr[j]] = [arr[j], arr[li]];
        return { ...m, lessons: arr };
      })
    );

  // ── Publish flow ──────────────────────────────────────────────────────
  // Single-transaction publish: every lesson's HTML is uploaded to IPFS
  // off-chain (no gas), then the full Course > Module > Lesson tree is
  // submitted to createCourseWithContent in one signature.
  async function publish() {
    if (!courseRegistry) return;
    setError(null);
    setPublishing(true);
    try {
      const walletProvider = courseRegistry.runner?.provider;
      const net = await walletProvider.getNetwork();
      if (net.chainId !== 31337n) {
        throw new Error(
          `MetaMask is on chain ${net.chainId}; switch to chain 31337 (RPC http://localhost:8545).`
        );
      }

      // Canonicalize modules: trim titles/descriptions, sanitize HTML, drop
      // empty rows. The sanitized HTML is the canonical form the on-chain
      // contentHash commits to.
      const validModules = modules
        .map((m) => ({
          title: m.title.trim(),
          description: m.description.trim(),
          lessons: m.lessons
            .map((l) => ({
              title: l.title.trim(),
              html: sanitizeForStorage(l.html),
              minutes: Math.max(0, Number(l.minutes) || 0),
            }))
            .filter((l) => l.title.length > 0),
        }))
        .filter((m) => m.title.length > 0);

      const totalLessons = validModules.reduce((a, m) => a + m.lessons.length, 0);

      // 1. Off-chain: upload every lesson's sanitized HTML to IPFS, capture
      //    its CID and the keccak256 hash of the same bytes.
      let li = 0;
      for (const mod of validModules) {
        for (const lesson of mod.lessons) {
          li++;
          setProgress({
            phase: "lessons-ipfs",
            current: li,
            total: totalLessons,
            label: `Uploading lesson content (${li}/${totalLessons})…`,
          });
          lesson.cid = await uploadLessonContent(lesson.html);
          lesson.hash = ethers.keccak256(ethers.toUtf8Bytes(lesson.html));
        }
      }

      // 2. Off-chain: upload course metadata JSON.
      setProgress({ phase: "meta", label: "Uploading course metadata…" });
      const meta = {
        title: title.trim(),
        description: description.trim(),
        thumbnail: thumbnail.trim(),
        difficulty,
        estimatedHours: Number(hours) || 0,
        tags,
      };
      const metaCID = await uploadJSON(meta);

      // 3. Build the calldata struct array for the single batched call.
      const modulesPayload = validModules.map((m) => ({
        title: m.title,
        description: m.description,
        lessons: m.lessons.map((l) => ({
          title: l.title,
          contentIpfsHash: l.cid,
          contentHash: l.hash,
          estimatedMinutes: l.minutes,
        })),
      }));

      // 4. Single signature: createCourseWithContent does the create +
      //    every addModule + every addLesson inside one transaction.
      const priceWei = ethers.parseEther(priceEth || "0");
      setProgress({
        phase: "publish",
        label: "Confirm in MetaMask — one transaction publishes everything.",
      });
      const readRegistry = makeReadRegistry();
      const before = await readRegistry.courseCount();
      const tx = await courseRegistry.createCourseWithContent(metaCID, priceWei, modulesPayload);
      setProgress({
        phase: "publish",
        label: `Transaction sent (${tx.hash.slice(0, 12)}…). Waiting for confirmation…`,
      });
      await tx.wait();
      const after = await readRegistry.courseCount();
      if (!(after > before)) {
        throw new Error("Course count did not change. MetaMask may be on a different node.");
      }
      const courseId = Number(after);

      setProgress({ phase: "done", label: "Done. Opening course…" });
      setTimeout(() => navigate(`/courses/${courseId}`), 600);
    } catch (err) {
      console.error(err);
      const msg = err.reason || err.shortMessage || err.message || String(err);
      setError(msg);
      setProgress(null);
    } finally {
      setPublishing(false);
    }
  }

  // ────── Step 1 ───────────────────────────────────────────────────────
  if (step === 1) {
    const canNext = title.trim() && description.trim() && priceEth !== "" && !thumbnailError && !tagsError;
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
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Solidity for Beginners" />
          </div>
          <div>
            <label className="label block mb-2">Description</label>
            <textarea className="input" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will students learn?" style={{ resize: "vertical" }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label block mb-2">Price (ETH) — 0 for free</label>
              <input className="input" type="number" min="0" step="0.001" value={priceEth} onChange={(e) => setPriceEth(e.target.value)} placeholder="0.05" />
            </div>
            <div>
              <label className="label block mb-2">Estimated total hours</label>
              <input className="input" type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="8" />
            </div>
          </div>
          <div>
            <label className="label block mb-2">Thumbnail URL (https://…)</label>
            <input className="input" type="url" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://example.com/thumb.png" />
            {thumbnailError && <p className="font-mono text-xs mt-1" style={{ color: "var(--danger)" }}>{thumbnailError}</p>}
          </div>
          <div>
            <label className="label block mb-2">Difficulty</label>
            <div className="flex gap-2">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setDifficulty(opt)}
                  className="btn btn-sm"
                  style={
                    difficulty === opt
                      ? { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "var(--accent)" }
                      : undefined
                  }
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label block mb-2">Tags (comma separated, max 5)</label>
            <input className="input" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="solidity, defi, security" />
            {tagsError && <p className="font-mono text-xs mt-1" style={{ color: "var(--danger)" }}>{tagsError}</p>}
            {tags.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {tags.map((t, i) => (
                  <span
                    key={i}
                    className="font-mono text-xs uppercase tracking-[0.16em] px-2 py-1"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)" }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => { if (validateStep1()) setStep(2); }}
              disabled={!canNext}
              className="btn btn-primary btn-lg"
            >
              Next →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ────── Step 2 ───────────────────────────────────────────────────────
  if (step === 2) {
    const hasContent = modules.some((m) => m.title.trim() && m.lessons.some((l) => l.title.trim()));
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
          <div className="lg:col-span-8 flex flex-col gap-5">
            {modules.map((mod, mi) => (
              <div key={mi} className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-xs uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                    Module {String(mi + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1" />
                  <button onClick={() => moveModule(mi, -1)} className="btn btn-ghost btn-sm" disabled={mi === 0}>↑</button>
                  <button onClick={() => moveModule(mi, 1)} className="btn btn-ghost btn-sm" disabled={mi === modules.length - 1}>↓</button>
                  {confirmRemove === `module-${mi}` ? (
                    <ConfirmInline
                      label="Remove module?"
                      onConfirm={() => { removeModule(mi); setConfirmRemove(null); }}
                      onCancel={() => setConfirmRemove(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(`module-${mi}`)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--danger)" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  className="input mb-3"
                  value={mod.title}
                  onChange={(e) => updateModule(mi, { title: e.target.value })}
                  placeholder="Module title…"
                />
                <textarea
                  className="input mb-4"
                  rows={2}
                  value={mod.description}
                  onChange={(e) => updateModule(mi, { description: e.target.value })}
                  placeholder="Module description…"
                  style={{ resize: "vertical" }}
                />

                <div className="flex flex-col gap-4">
                  {mod.lessons.map((lesson, li) => (
                    <div
                      key={li}
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                      className="p-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                          Lesson {li + 1}
                        </span>
                        <div className="flex-1" />
                        <button onClick={() => moveLesson(mi, li, -1)} disabled={li === 0} className="btn btn-ghost btn-sm">↑</button>
                        <button onClick={() => moveLesson(mi, li, 1)} disabled={li === mod.lessons.length - 1} className="btn btn-ghost btn-sm">↓</button>
                        {confirmRemove === `lesson-${mi}-${li}` ? (
                          <ConfirmInline
                            label="Remove lesson?"
                            onConfirm={() => { removeLesson(mi, li); setConfirmRemove(null); }}
                            onCancel={() => setConfirmRemove(null)}
                          />
                        ) : (
                          <button
                            onClick={() => setConfirmRemove(`lesson-${mi}-${li}`)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--danger)" }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2 mb-3">
                        <input
                          className="input"
                          value={lesson.title}
                          onChange={(e) => updateLesson(mi, li, { title: e.target.value })}
                          placeholder="Lesson title…"
                        />
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={lesson.minutes}
                          onChange={(e) => updateLesson(mi, li, { minutes: e.target.value })}
                          placeholder="Minutes"
                        />
                      </div>
                      <Editor
                        content={lesson.html}
                        onChange={(html) => updateLesson(mi, li, { html })}
                        placeholder="Write the lesson…"
                      />
                    </div>
                  ))}
                  <button onClick={() => addLesson(mi)} className="btn btn-outline btn-sm self-start">
                    + Add lesson
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addModule} className="btn btn-outline self-start">
              + Add module
            </button>
          </div>

          <aside className="lg:col-span-4">
            <div className="card p-5 sticky top-20">
              <p className="eyebrow mb-3">Outline preview</p>
              <h3 className="font-display font-semibold text-lg mb-3" style={{ color: "var(--text)" }}>
                {title || "Untitled course"}
              </h3>
              {modules.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>No content yet.</p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {modules.map((m, mi) => (
                    <li key={mi}>
                      <p className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                        Module {String(mi + 1).padStart(2, "0")}
                      </p>
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
                        {m.title || "Untitled module"}
                      </p>
                      <ul className="ml-3 text-xs flex flex-col gap-1" style={{ color: "var(--muted)" }}>
                        {m.lessons.filter((l) => l.title.trim()).map((l, j) => (
                          <li key={j}>· {l.title} <span style={{ color: "var(--muted-2)" }}>({l.minutes || 0}m)</span></li>
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

  // ────── Step 3 ───────────────────────────────────────────────────────
  const totalModules = modules.filter((m) => m.title.trim()).length;
  const totalLessonsCt = modules.reduce(
    (acc, m) => acc + (m.title.trim() ? m.lessons.filter((l) => l.title.trim()).length : 0),
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

      <div
        className="card p-4 mb-4"
        style={{ background: "var(--surface-2)", borderColor: "var(--accent)" }}
      >
        <p className="eyebrow mb-1" style={{ color: "var(--accent)" }}>Permanent</p>
        <p className="text-sm" style={{ color: "var(--text)" }}>
          Once published, course structure is permanent on the blockchain. You can add new
          modules and lessons later but cannot edit or delete existing ones.
        </p>
      </div>

      <div className="card p-4 mb-4">
        <p className="eyebrow mb-1">Signatures required</p>
        <p className="font-mono text-sm" style={{ color: "var(--text)" }}>
          1 transaction ·{" "}
          <span style={{ color: "var(--muted)" }}>
            createCourseWithContent batches {totalModules} module{totalModules === 1 ? "" : "s"} + {totalLessonsCt} lesson{totalLessonsCt === 1 ? "" : "s"}
          </span>
        </p>
        <p className="font-mono text-xs mt-1" style={{ color: "var(--muted-2)" }}>
          + {totalLessonsCt} IPFS upload{totalLessonsCt === 1 ? "" : "s"} for lesson content (off-chain, no gas, no signature)
        </p>
      </div>

      <div className="card p-6 mb-6 flex flex-col gap-4">
        <div>
          <p className="eyebrow mb-1">Title</p>
          <p className="font-display text-xl" style={{ color: "var(--text)" }}>{title}</p>
        </div>
        <div>
          <p className="eyebrow mb-1">Description</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--muted)" }}>{description}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="eyebrow mb-1">Price</p>
            <p className="font-mono text-base" style={{ color: "var(--text)" }}>
              {priceEth === "0" || priceEth === "" ? "FREE" : `${priceEth} ETH`}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-1">Difficulty</p>
            <p className="font-mono text-base" style={{ color: "var(--text)" }}>{difficulty}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Hours</p>
            <p className="font-mono text-base" style={{ color: "var(--text)" }}>{hours || "—"}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Tags</p>
            <p className="font-mono text-xs" style={{ color: "var(--muted)" }}>
              {tags.length ? tags.map((t) => "#" + t).join(" ") : "—"}
            </p>
          </div>
        </div>
        <div>
          <p className="eyebrow mb-2">Outline</p>
          <ol className="flex flex-col gap-2">
            {modules.filter((m) => m.title.trim()).map((m, mi) => {
              const ll = m.lessons.filter((l) => l.title.trim());
              return (
                <li key={mi}>
                  <p className="text-sm" style={{ color: "var(--text)" }}>
                    <span className="font-mono text-xs mr-2" style={{ color: "var(--muted)" }}>
                      M{String(mi + 1).padStart(2, "0")}
                    </span>
                    {m.title} <span style={{ color: "var(--muted-2)" }}>· {ll.length} lesson{ll.length === 1 ? "" : "s"}</span>
                  </p>
                </li>
              );
            })}
          </ol>
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
