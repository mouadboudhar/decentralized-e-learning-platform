import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

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
      className="absolute right-0 top-12 w-72 z-50"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="eyebrow mb-1">Connected wallet</p>
        <p className="font-mono text-sm break-all" style={{ color: "var(--text)" }}>{account}</p>
      </div>
      <button
        onClick={copyAddress}
        className="w-full text-left px-4 py-2.5 text-xs uppercase tracking-widest font-mono"
        style={{ color: "var(--muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
      >
        Copy address
      </button>
      <div className="divider" />
      <button
        onClick={() => { disconnect(); onClose(); }}
        className="w-full text-left px-4 py-2.5 text-xs uppercase tracking-widest font-mono"
        style={{ color: "var(--danger)" }}
      >
        Disconnect
      </button>
    </div>
  );
}

const navLinks = [
  { to: "/courses", label: "Courses" },
  { to: "/create", label: "Create" },
  { to: "/certificates", label: "Certificates" },
  { to: "/account", label: "Account" },
];

export function Navbar({ account, connect, disconnect }) {
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const short = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : null;

  return (
    <nav
      className="sticky top-0 z-40"
      style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <span
            className="font-mono text-xs uppercase tracking-[0.2em] px-2 py-1"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            LC
          </span>
          <span className="font-mono text-sm uppercase tracking-[0.18em]" style={{ color: "var(--text)" }}>
            LEARNCHAIN
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ to, label }) => {
            const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className="px-3 py-2 text-xs uppercase tracking-[0.16em] font-mono"
                style={{
                  color: active ? "var(--accent)" : "var(--muted)",
                  borderBottom: active ? "1px solid var(--accent)" : "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.color = "var(--muted)";
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="px-3 py-2 font-mono text-sm"
            style={{
              color: "var(--muted)",
              border: "1px solid var(--border)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>

          <div className="relative">
            {account ? (
              <>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em]"
                  style={{
                    background: "var(--surface)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <span
                    className="w-1.5 h-1.5"
                    style={{ background: "var(--accent)" }}
                  />
                  {short}
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
              <button onClick={connect} className="btn btn-primary btn-sm">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
