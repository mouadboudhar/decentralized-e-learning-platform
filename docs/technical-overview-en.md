# Technical Overview

LearnChain is a decentralized e-learning platform built on Ethereum. Instructors publish courses on chain, students pay directly in ETH, and completion certificates are minted as soulbound ERC-721 NFTs.

This document covers the technical building blocks: the smart contracts, the off-chain content pipeline, the rich text editor, the sanitization model, and the Coursera-style UX.

## Stack

| Layer | Tech |
|---|---|
| Contracts | Solidity ^0.8.24, Hardhat, OpenZeppelin |
| Frontend | React 19, Vite, ethers.js v6, react-router-dom |
| Rich text | TipTap (StarterKit, Underline, Highlight, TextAlign, Typography, Placeholder, Link, Image, CodeBlockLowlight + lowlight) |
| Sanitization | DOMPurify with a strict allowlist |
| Off-chain storage | IPFS via Pinata (data: URI fallback when no Pinata keys are set) |
| Wallet | MetaMask via `window.ethereum` |

## Course hierarchy

The contract is organized as **Course > Module > Lesson** (Coursera-style).

- **Course** — top-level entity. Owned by an instructor address. Has a price, an IPFS metadata CID (title, description, thumbnail, difficulty, estimated hours, tags) and a list of modules.
- **Module** — an ordered group of lessons inside a course. Has a title, a description, and a maintained `lessonCount`.
- **Lesson** — a unit of content. Stores `title`, `contentIpfsHash` (the CID of the sanitized HTML payload on IPFS), `contentHash` (keccak256 of the sanitized HTML for integrity verification), `estimatedMinutes`, and `lessonIndex`.

The contract also keeps `totalLessons[courseId]` so the frontend can compute progress without walking every module.

### Contract surface

```solidity
function createCourse(string ipfsHash, uint256 price) external returns (uint256);
function enroll(uint256 courseId) external payable;
function markComplete(uint256 courseId, address student) external; // instructor only
function claimPayment(uint256 courseId) external;                   // instructor only

function addModule(uint256 courseId, string title, string description) external returns (uint256);
function addLesson(
    uint256 courseId,
    uint256 moduleIndex,
    string title,
    string contentIpfsHash,
    bytes32 contentHash,
    uint256 estimatedMinutes
) external returns (uint256);

function getModule(uint256, uint256)            external view returns (Module);
function getLesson(uint256, uint256, uint256)   external view returns (Lesson);
function getModuleCount(uint256)                external view returns (uint256);
function getLessonCount(uint256, uint256)       external view returns (uint256);
function getTotalLessons(uint256)               external view returns (uint256);
```

`CertificateNFT.sol` extends OpenZeppelin's `ERC721 + Ownable`. `transferFrom` and `safeTransferFrom` always revert with `"Soulbound: non-transferable"`, so issued certificates cannot be moved off the recipient wallet.

## Off-chain content storage

Lesson HTML is too large to store on chain economically. Instead:

1. The frontend sanitizes the editor HTML through `sanitizeForStorage` (see below).
2. The sanitized bytes are uploaded to IPFS via `uploadLessonContent` — either through Pinata if `VITE_PINATA_API_KEY` / `VITE_PINATA_SECRET` are configured, or inlined as a `data:text/html;base64,...` URI as a fallback.
3. The frontend computes `keccak256(toUtf8Bytes(sanitizedHTML))` and passes both the CID and the hash to `addLesson`.

This gives us **content integrity verification**: when the lesson is rendered later, the frontend re-fetches the CID, re-sanitizes the payload, and re-hashes it. If the hash doesn't match the on-chain `contentHash`, a prominent warning banner is shown to the student:

> ⚠ Content integrity warning — This lesson content could not be verified. The content may have been tampered with. Do not trust external links in this lesson.

## TipTap integration

`frontend/src/components/Editor.jsx` is a reusable rich text editor used both in the publish flow (`CreateCourse`) and in the instructor management panel (`Account`).

Extensions:

- **StarterKit** without its built-in `codeBlock` — replaced by **CodeBlockLowlight** with the `common` lowlight grammar bundle for syntax highlighting.
- **SafeLink** — wraps `@tiptap/extension-link` with a `validate` callback that rejects any href that is not `https://`. `target="_blank"` and `rel="noopener noreferrer"` are forced on every produced anchor.
- **SafeImage** — wraps `@tiptap/extension-image` with a `setImage` override that rejects any `src` that is not `https://` or `data:image/<png|jpeg|gif|webp|svg+xml>;base64,...`.
- **Underline**, **Highlight**, **TextAlign** (headings + paragraphs), **Typography**, **Placeholder**.

The toolbar is grouped with vertical separators: Bold/Italic/Underline/Strikethrough/Highlight · H1/H2/H3/P · Bullet list/Ordered list · Blockquote/Code block/Horizontal rule · Align left/center/right · Link/Image. Link and Image buttons open small inline popovers that validate the URL before applying.

**Critically**, the editor never exposes raw HTML to its parent. The `onUpdate` callback runs the output through `sanitizeHTML` before invoking the parent's `onChange`. The parent never sees unsanitized content — defense in depth.

## Sanitization model (DOMPurify)

`frontend/src/utils/sanitize.js` is the single source of truth for HTML safety. Two helpers are exported:

- `sanitizeHTML(dirty)` — runs DOMPurify with the strict config; used at every render and as a wrapper around editor output.
- `sanitizeForStorage(dirty)` — same as `sanitizeHTML` plus comment stripping and whitespace trimming, so two identical pastes produce the same `keccak256` hash. Use this before uploading to IPFS or sending to the contract.

### Allowlist

```
ALLOWED_TAGS: p, br, div, span, hr, strong, em, u, s, mark, code,
              h1, h2, h3, h4, blockquote, pre, ul, ol, li,
              a, img, table, thead, tbody, tr, th, td
ALLOWED_ATTR: href, src, alt, title, class, target, rel, colspan, rowspan
FORBID_TAGS:  script, style, iframe, form, input, button, object, embed, base
FORBID_ATTR:  on* event handlers (onerror, onload, onclick, …), style, "javascript"
ALLOW_DATA_ATTR: false
ALLOWED_URI_REGEXP: https:, data:image/<format>;base64, mailto:, #anchor, /relative
```

### afterSanitizeAttributes hook

Even with the allowlist, two extra passes run on every element:

1. Anchors — any `href` that is not `https://`, `mailto:`, in-page anchor, or relative path is dropped. `target="_blank"` and `rel="noopener noreferrer"` are forced on every `https://` anchor (prevents tab-napping and reverse `window.opener` attacks).
2. Images — any `src` that is not `https://` or `data:image/<format>;base64,...` causes the entire `<img>` element to be removed (we don't leave a broken `<img>` with no `src`).
3. Every `on*` attribute is stripped a second time as a final pass.

### Defense-in-depth rule

Every place that touches HTML follows the same rule:

> Sanitize on input before storage. Sanitize again on output before render. Never use `dangerouslySetInnerHTML` without a `sanitizeHTML(...)` call in the same expression.

This means:

- The TipTap editor sanitizes before exposing its HTML to the parent.
- `sanitizeForStorage` runs before IPFS upload.
- `uploadLessonContent` re-sanitizes inside the upload helper.
- `fetchLessonContent` re-sanitizes after fetching from IPFS.
- The `CourseDetail` view sanitizes again right before rendering, inside `dangerouslySetInnerHTML={{ __html: sanitizeHTML(lessonHTML) }}`.

## Coursera-style UX

`CourseDetail.jsx` implements a Coursera-style two-column layout:

- **Header row** above the split shows the course title, instructor, price, enrollment count (from `StudentEnrolled` events), module count, total lessons, estimated hours, difficulty, and the Enroll / Enrolled / Completed CTA.
- **Left sidebar** (280px, sticky on desktop) lists modules as accordion blocks. Each block shows its number, title, description preview, total estimated time, and a `done/total` indicator. Expanded modules reveal their lessons with a circular completion mark, the lesson title, and the per-lesson minute estimate. The active lesson gets a 2px accent left border.
- **Sequential unlocking** is UI-only: module N+1 is locked (and not clickable) until every lesson in module N is completed. Locked modules show a 🔒 indicator. This is purely a UX guardrail — the contract does not enforce any ordering.
- **Main content** shows a breadcrumb (Courses / Course Title / Module / Lesson), the lesson title, the read-time estimate, the integrity warning banner if hashes don't match, and the sanitized HTML inside a `.prose` wrapper.
- **Footer controls** include Previous/Next navigation that respects locks and a Mark-as-Complete toggle. When every lesson is checked off, a completion banner offers `Complete Course and Earn Certificate` which calls `markComplete` and routes to `/certificates`.

Per-lesson progress is stored in `localStorage` under the key
`learnchain_progress_{account}_{courseId}_{moduleIndex}_{lessonIndex}`, so progress is wallet-scoped without spending any gas.

## Threat model summary

The trust boundary is: **the instructor wallet is untrusted user input**. Every piece of content the instructor types into the editor is treated as hostile:

- XSS via `<script>` / `<iframe>` / event handlers — blocked by FORBID_TAGS + FORBID_ATTR.
- Reverse tab-napping via instructor-added links — blocked by forced `rel="noopener noreferrer"` and `target="_blank"`.
- Mixed-content / man-in-the-middle via `http://` images — blocked by the `https://`-only `src` check.
- Data exfiltration via `javascript:` URLs — blocked by the URI regex + per-attribute validators.
- Tampering with off-chain content — detected by the `keccak256` integrity check; mismatched lessons render with a banner.
- Untrusted IPFS payloads — re-sanitized in `fetchLessonContent` and again at render time.

## Local development

```bash
# Root
npm install
npx hardhat test                          # 18 tests should pass
npx hardhat node                          # in one terminal
npx hardhat run scripts/deploy.js --network localhost  # writes contracts.js

# Frontend
cd frontend
npm install
npm run dev                               # http://localhost:5173
```

`scripts/deploy.js` seeds a small set of demo courses (with one module each on the free courses) so the catalogue isn't empty on a fresh chain.

`bash start.sh` from the project root brings up the node, deploys, and runs the frontend in one command.
