import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

function WalletDropdown({ account, disconnect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  function copyAddress() {
    navigator.clipboard.writeText(account);
    onClose();
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-12 w-64 rounded-xl border border-white/10 bg-gray-950/95 backdrop-blur-md shadow-xl shadow-black/50 p-3 z-50 flex flex-col gap-1"
    >
      <p className="text-xs text-gray-500 px-2 pt-1 pb-0.5">Connected wallet</p>
      <p className="font-mono text-sm text-white px-2 pb-2 break-all">{account}</p>
      <hr className="border-white/10 mb-1" />
      <button
        onClick={copyAddress}
        className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Copy address
      </button>
      <button
        onClick={() => { disconnect(); onClose(); }}
        className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Disconnect
      </button>
    </div>
  );
}

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/courses", label: "Courses" },
  { to: "/create", label: "Create" },
  { to: "/certificates", label: "Certificates" },
];

export function Navbar({ account, connect, disconnect }) {
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const short = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : null;

  return (
    <nav className="sticky top-0 z-40 border-b border-white/5 bg-gray-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-indigo-500/25">
            L
          </div>
          <span className="font-semibold text-white tracking-tight">LearnChain</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ to, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/8 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Wallet */}
        <div className="relative">
          {account ? (
            <>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 px-3 py-1.5 rounded-lg text-sm font-mono transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
                {short}
                <svg className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {dropdownOpen && (
                <WalletDropdown
                  account={account}
                  disconnect={disconnect}
                  onClose={() => setDropdownOpen(false)}
                />
              )}
            </>
          ) : (
            <button
              onClick={connect}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
