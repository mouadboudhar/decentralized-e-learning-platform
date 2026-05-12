import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { uploadJSON } from "../utils/ipfs";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../utils/contracts";

// Read-only handle on the SAME node the Courses page reads from (via /rpc proxy).
function makeReadRegistry() {
  const provider = new ethers.JsonRpcProvider(
    `${window.location.origin}/rpc`,
    { chainId: 31337, name: "hardhat" },
    { staticNetwork: true }
  );
  return new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-colors";

export function CreateCourse({ account, connect, courseRegistry }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceEth, setPriceEth] = useState("");
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState(null); // { type: "info"|"success"|"error", message }
  const navigate = useNavigate();

  if (!account) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[70vh] gap-5 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl">
          🔒
        </div>
        <div>
          <p className="text-white font-semibold text-lg mb-1">Wallet not connected</p>
          <p className="text-gray-400 text-sm">Connect your wallet to publish a course.</p>
        </div>
        <button
          onClick={connect}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
        >
          Connect Wallet
        </button>
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!courseRegistry) return;
    setStatus(null);
    setCreating(true);
    try {
      // 1. The app's blockchain node is chain 31337. If MetaMask is on anything
      //    else, the tx goes to the wrong chain and the course never appears here.
      const walletProvider = courseRegistry.runner?.provider;
      const net = await walletProvider.getNetwork();
      if (net.chainId !== 31337n) {
        setStatus({
          type: "error",
          message:
            `MetaMask is connected to chain ${net.chainId}, but this app uses chain 31337. ` +
            `Switch MetaMask to the Hardhat network — RPC URL http://localhost:8545, Chain ID 31337 — then publish again.`,
        });
        return;
      }

      // 2. Snapshot the course count on the node the Courses page actually reads.
      const readRegistry = makeReadRegistry();
      const before = await readRegistry.courseCount();

      // 3. Send the transaction through MetaMask.
      const ipfsHash = await uploadJSON({ title, description });
      const priceWei = ethers.parseEther(priceEth);
      const tx = await courseRegistry.createCourse(ipfsHash, priceWei);
      setStatus({ type: "info", message: `Transaction sent (${tx.hash.slice(0, 12)}…). Waiting for confirmation…` });
      const receipt = await tx.wait();

      // 4. Verify it landed on *this* node — not some other one MetaMask points at.
      const after = await readRegistry.courseCount();
      if (after > before) {
        setStatus({ type: "success", message: `Course #${after} published. Opening the catalogue…` });
        setTimeout(() => navigate("/courses"), 900);
      } else {
        setStatus({
          type: "error",
          message:
            `Your transaction was mined (block ${receipt.blockNumber}) but the course count on this app's node ` +
            `didn't change — it's still ${before}. That means MetaMask sent it to a different node than the one this app reads from. ` +
            `In MetaMask, delete any old "Localhost 8545" network and use exactly: RPC URL http://localhost:8545, Chain ID 31337.`,
        });
      }
    } catch (err) {
      console.error(err);
      let msg = err.reason || err.shortMessage || err.message || String(err);
      if (/nonce/i.test(msg)) {
        msg += "  —  The blockchain node was probably restarted. In MetaMask: Settings → Advanced → Clear activity tab data (reset account), then retry.";
      } else if (/insufficient funds/i.test(msg)) {
        msg += "  —  This account has no ETH on the Hardhat node. Import one of the test accounts Hardhat prints on startup (they each have 10000 ETH).";
      }
      setStatus({ type: "error", message: msg });
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-14">
      {/* Header */}
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">Create a Course</h2>
        <p className="text-gray-400 text-sm">
          Course metadata is stored on IPFS. Price and enrollment are managed on-chain.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent p-6 flex flex-col gap-5"
      >
        <Field label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Solidity for Beginners"
            className={inputClass}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            placeholder="What will students learn?"
            className={`${inputClass} resize-none`}
          />
        </Field>

        <Field label="Price (ETH)">
          <input
            type="number"
            value={priceEth}
            onChange={(e) => setPriceEth(e.target.value)}
            required
            min="0"
            step="0.001"
            placeholder="0.05"
            className={inputClass}
          />
        </Field>

        {status && (
          <div
            className={`rounded-xl px-4 py-3 text-sm border break-words ${
              status.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-300"
                : status.type === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-300"
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
            }`}
          >
            {status.message}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={creating}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 text-white py-3 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none"
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publishing…
              </span>
            ) : (
              "Publish Course"
            )}
          </button>
        </div>
      </form>
    </main>
  );
}
