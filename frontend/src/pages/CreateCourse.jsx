import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { uploadJSON } from "../utils/ipfs";

export function CreateCourse({ account, connect, courseRegistry }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceEth, setPriceEth] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  if (!account) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400 text-lg">Connect your wallet to create a course.</p>
        <button
          onClick={connect}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Connect Wallet
        </button>
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!courseRegistry) return;
    setCreating(true);
    try {
      const ipfsHash = await uploadJSON({ title, description });
      const priceWei = ethers.parseEther(priceEth);
      const tx = await courseRegistry.createCourse(ipfsHash, priceWei);
      await tx.wait();
      navigate("/courses");
    } catch (err) {
      console.error(err);
      alert("Transaction failed: " + (err.reason || err.message));
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold text-white mb-8">Create a Course</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Solidity for Beginners"
            className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            placeholder="What will students learn?"
            className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-gray-300 text-sm font-medium">Price (ETH)</label>
          <input
            type="number"
            value={priceEth}
            onChange={(e) => setPriceEth(e.target.value)}
            required
            min="0"
            step="0.001"
            placeholder="0.05"
            className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={creating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
        >
          {creating ? "Creating..." : "Create Course"}
        </button>
      </form>
    </main>
  );
}
