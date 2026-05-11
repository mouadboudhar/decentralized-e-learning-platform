import { Link } from "react-router-dom";

export function Navbar({ account, connect }) {
  const shortAddress = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  return (
    <nav className="sticky top-0 z-50 bg-gray-950 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <Link to="/" className="text-indigo-400 font-bold text-xl tracking-tight">
        LearnChain
      </Link>

      <div className="flex items-center gap-6">
        <Link to="/" className="text-gray-300 hover:text-white transition-colors">
          Home
        </Link>
        <Link to="/courses" className="text-gray-300 hover:text-white transition-colors">
          Courses
        </Link>
        <Link to="/create" className="text-gray-300 hover:text-white transition-colors">
          Create
        </Link>
        <Link to="/certificates" className="text-gray-300 hover:text-white transition-colors">
          Certificates
        </Link>
      </div>

      <div>
        {account ? (
          <span className="bg-indigo-900 text-indigo-300 px-3 py-1 rounded-full text-sm font-mono">
            {shortAddress}
          </span>
        ) : (
          <button
            onClick={connect}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
