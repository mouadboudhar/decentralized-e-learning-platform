import { sanitizeHTML } from "./sanitize";

const PINATA_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

function pinataAuth() {
  const apiKey = import.meta.env.VITE_PINATA_API_KEY;
  const secret = import.meta.env.VITE_PINATA_SECRET;
  if (!apiKey || !secret) return null;
  return { apiKey, secret };
}

/** Upload a JSON payload. Returns the IPFS CID (or a data: URI fallback). */
export async function uploadJSON(data) {
  const auth = pinataAuth();
  if (auth) {
    const response = await fetch(PINATA_JSON_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: auth.apiKey,
        pinata_secret_api_key: auth.secret,
      },
      body: JSON.stringify({ pinataContent: data }),
    });
    const result = await response.json();
    return result.IpfsHash;
  }
  // No Pinata configured: embed the metadata inline as a data: URI so it still
  // round-trips without any external service.
  return "data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

/**
 * Upload sanitized lesson HTML to IPFS. The caller MUST sanitize the HTML
 * (sanitizeForStorage) before passing it here. We do a final sanitize anyway,
 * but the caller is responsible for the hash-eligible canonical form.
 *
 * Returns the IPFS CID (or a data:text/html;base64 fallback) — store this
 * string on-chain as the lesson's contentIpfsHash.
 */
export async function uploadLessonContent(sanitizedHTML) {
  if (typeof sanitizedHTML !== "string") {
    throw new TypeError("uploadLessonContent: sanitizedHTML must be a string");
  }
  // Re-sanitize defensively. If the caller forgot, this still keeps stored
  // content clean. The canonical form is whatever the caller passed in — if
  // they used sanitizeForStorage(), this pass is a no-op.
  const safe = sanitizeHTML(sanitizedHTML);

  const auth = pinataAuth();
  if (auth) {
    const form = new FormData();
    const file = new Blob([safe], { type: "text/html; charset=utf-8" });
    form.append("file", file, "lesson.html");
    const response = await fetch(PINATA_FILE_URL, {
      method: "POST",
      headers: {
        pinata_api_key: auth.apiKey,
        pinata_secret_api_key: auth.secret,
      },
      body: form,
    });
    const result = await response.json();
    if (!result?.IpfsHash) throw new Error("Pinata upload failed");
    return result.IpfsHash;
  }

  // Fallback when no Pinata: inline as a data: URI. UTF-8 safe base64.
  return (
    "data:text/html;base64," +
    btoa(unescape(encodeURIComponent(safe)))
  );
}

export function ipfsToHttp(hash) {
  if (typeof hash !== "string") return "";
  if (hash.startsWith("data:")) return hash;
  if (hash.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${hash.replace("ipfs://", "")}`;
  }
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}

/**
 * Fetch lesson HTML from IPFS and sanitize before returning. Even though the
 * payload was sanitized at write time, we never trust off-chain storage —
 * always re-sanitize after fetch.
 */
export async function fetchLessonContent(cid) {
  if (!cid) return "";
  const res = await fetch(ipfsToHttp(cid));
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  // data: URI fallback returns the right Content-Type already.
  const text = await res.text();
  return sanitizeHTML(text);
}
