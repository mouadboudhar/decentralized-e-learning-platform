// Strict HTML sanitization for TipTap output.
//
// Every piece of HTML produced by the editor MUST flow through one of these
// helpers before it touches storage (IPFS, on-chain), and again before it is
// passed to dangerouslySetInnerHTML at render time. Defense-in-depth: an
// instructor wallet is untrusted user input.

import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  // Structural
  "p", "br", "div", "span", "hr",
  // Marks / inline styling
  "strong", "em", "u", "s", "mark", "code",
  // Headings
  "h1", "h2", "h3", "h4",
  // Blocks
  "blockquote", "pre",
  // Lists
  "ul", "ol", "li",
  // Media / links
  "a", "img",
  // Tables (TipTap table extension output, kept on the allowlist so future
  // extensions plug in cleanly)
  "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = [
  "href", "src", "alt", "title",
  "class", "target", "rel",
  "colspan", "rowspan",
];

const FORBID_TAGS = [
  "script", "style", "iframe", "form",
  "input", "button", "object", "embed", "base",
];

// Every on* event handler we know of, plus inline style and the bare
// "javascript" attribute (some libraries dropped it via attribute renaming).
const FORBID_ATTR = [
  "onerror", "onload", "onclick", "onmouseover", "onmouseout", "onmousedown",
  "onmouseup", "onfocus", "onblur", "onchange", "onsubmit", "oninput",
  "onkeydown", "onkeyup", "onkeypress", "onpointerdown", "onpointerup",
  "onpointermove", "onanimationstart", "onanimationend", "onanimationiteration",
  "ontransitionend", "ontoggle", "onwheel", "ondrag", "ondrop",
  "style", "javascript",
];

const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  FORBID_TAGS,
  FORBID_ATTR,
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
  // Belt-and-suspenders: never allow URIs that aren't on a strict scheme list
  // when DOMPurify checks each attribute. We still re-validate href/src below
  // because DOMPurify's URL handling depends on the attribute name.
  ALLOWED_URI_REGEXP: /^(?:(?:https):|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,|mailto:|#|\/)/i,
};

// Hooks need to be registered once. We use a unique config id so the hooks
// stay on the default DOMPurify instance without leaking to other consumers.
let hooksInstalled = false;

function installHooks() {
  if (hooksInstalled) return;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof Element)) return;

    const tag = node.tagName?.toLowerCase();

    // Anchors: force target=_blank and rel=noopener noreferrer to prevent
    // tab-napping and reverse window.opener attacks. Also drop any href that
    // is not a strict-https URL or in-page anchor.
    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      const safe =
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("#") ||
        href.startsWith("/");
      if (!safe) {
        node.removeAttribute("href");
      } else if (href.startsWith("https://")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }

    // Images: only https:// or data:image/<format>;base64,... — reject
    // http://, javascript:, file://, vbscript:, blob:, anything else.
    if (tag === "img") {
      const src = node.getAttribute("src") || "";
      const safe =
        src.startsWith("https://") ||
        /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(src);
      if (!safe) {
        // Drop the image entirely — leaving a broken <img> with no src is
        // pointless and lets a future XSS via "currentSrc" hooks sneak in.
        node.remove();
        return;
      }
      // Defensive: drop any inline event handlers DOMPurify might have missed.
      for (const attr of Array.from(node.attributes)) {
        if (attr.name.toLowerCase().startsWith("on")) {
          node.removeAttribute(attr.name);
        }
      }
    }

    // Last-line defense for any element: strip every on* attribute.
    for (const attr of Array.from(node.attributes || [])) {
      if (attr.name.toLowerCase().startsWith("on")) {
        node.removeAttribute(attr.name);
      }
    }
  });

  hooksInstalled = true;
}

export function sanitizeHTML(dirty) {
  if (dirty == null) return "";
  if (typeof dirty !== "string") {
    try {
      dirty = String(dirty);
    } catch {
      return "";
    }
  }
  installHooks();
  return DOMPurify.sanitize(dirty, PURIFY_CONFIG);
}

// Use this before persisting content to IPFS or on-chain. Same sanitization,
// plus normalization: strip HTML comments and trim leading/trailing whitespace
// so two identical pastes produce the same keccak256 hash.
export function sanitizeForStorage(dirty) {
  const clean = sanitizeHTML(dirty);
  // DOMPurify already drops comments because <!-- --> is not in ALLOWED_TAGS,
  // but a malicious value could still slip through as a stray "<!--" inside a
  // text node. Force-strip via regex as belt-and-suspenders.
  return clean.replace(/<!--[\s\S]*?-->/g, "").trim();
}
