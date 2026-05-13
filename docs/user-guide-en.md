# User Guide

LearnChain is a decentralized learning platform. There are two kinds of users: **students** who enroll in courses and earn soulbound NFT certificates, and **instructors** who publish courses and accept payment directly to their wallet.

## Before you start

1. Install [MetaMask](https://metamask.io/) and create or import a wallet.
2. Connect the wallet to the LearnChain network: RPC `http://localhost:8545`, Chain ID `31337` (for local development) or Sepolia for testnet.
3. Visit the app and click **Connect Wallet** in the top right.

## For students

### Browsing courses

The **Courses** page lists every course on the registry. Use the controls to narrow the catalogue:

- **Search** by title (debounced, 300 ms).
- **All / Free / Paid** pill filters.
- **Sort** dropdown (Newest, Oldest, Price ↑, Price ↓).

Click any course card to open its detail page.

### The course detail page

A LearnChain course is organized like a Coursera course:

> **Course** → **Module 01** → Lesson 1, Lesson 2, … → **Module 02** → …

The detail page has two columns. On the left, a sticky syllabus shows every module as an accordion. Each module shows the number of lessons it contains and the total estimated time. Click a module header to expand it; click any lesson inside to load it in the main pane.

The main pane shows the lesson title, an estimated read-time, and the rich text content (headings, lists, images, code blocks, blockquotes, etc.).

### Enrolling

If a course has a price, the **Enroll** button on the header sends the price in ETH directly to the contract. The transaction is signed in MetaMask. Free courses can be enrolled in the same way with no ETH transfer.

### Marking lessons complete

Each lesson has a **Mark as Complete** button at the bottom. Toggling it updates your local progress (stored in your browser, keyed to your wallet). The sidebar shows a filled checkmark next to every completed lesson, and the overall progress bar at the top of the sidebar tracks `X / Y lessons`.

### Sequential unlocking

Module N+1 stays **locked** until every lesson in module N is marked complete. Locked modules show a 🔒 icon and cannot be clicked. This is a UX guardrail to encourage linear progression — it's enforced in the browser only, not by the smart contract.

### Earning a certificate

When every lesson in the course is checked off, a completion banner appears at the bottom of the main pane:

> All lessons complete. Earn your certificate.

The instructor (the wallet that created the course) then calls `markComplete` for your address. After that transaction is mined, you can view your certificate on the **Certificates** page. Certificates are **soulbound** ERC-721 NFTs — they cannot be transferred, sold, or moved off your wallet.

### Content integrity

LearnChain stores the lesson HTML on IPFS and a `keccak256` hash of the content on chain. If the IPFS payload is ever altered, the hash will no longer match, and the lesson view will show a warning banner:

> ⚠ Content integrity warning — This lesson content could not be verified. The content may have been tampered with. Do not trust external links in this lesson.

If you see this banner, treat the lesson as untrusted. The course author can fix it by re-uploading the original content.

## For instructors

### Publishing a course

The **Create** page walks through a three-step flow.

#### Step 1 — Course info

- **Title**, **Description**.
- **Price** in ETH. Set to `0` for a free course.
- **Estimated total hours**.
- **Thumbnail URL** — must start with `https://`. Mixed-content URLs are rejected.
- **Difficulty** — Beginner, Intermediate, or Advanced.
- **Tags** — up to 5, comma-separated.

#### Step 2 — Content

Build the syllabus as **Modules** containing **Lessons**.

Each lesson has:

- A **title**.
- An **estimated minutes** value.
- A **rich text editor** for the lesson body.

The editor toolbar gives you: bold, italic, underline, strikethrough, highlight; H1–H3 + paragraph; bullet and numbered lists; blockquote, code block, horizontal rule; left/center/right alignment; links and images.

**Links must start with `https://`.** `http://` and `javascript:` links are rejected at the editor level and again at the sanitizer level.

**Images must start with `https://`** or be inline `data:image/<format>;base64,...`. Anything else is dropped.

Modules and lessons can be reordered (up/down arrows) and deleted with a Confirm/Cancel inline guard.

The right-hand panel shows a live outline preview as you build.

#### Step 3 — Review & publish

The review screen shows a summary of your course, a permanence warning, and the transaction count estimate:

> N transactions: 1 create + M modules + L lessons.

Plus L off-chain IPFS uploads for lesson content (no gas).

Clicking **Publish Course** runs this pipeline:

1. For every lesson: sanitize the HTML, upload to IPFS, compute `keccak256` of the sanitized bytes.
2. Upload the course metadata JSON to IPFS.
3. Sign and send `createCourse(metadataCID, priceWei)`.
4. For every module: sign and send `addModule(...)`.
5. For every lesson: sign and send `addLesson(courseId, moduleIndex, title, contentCID, contentHash, minutes)`.

Progress is reported per phase. On success you are redirected to the new course detail page.

> **Heads up:** course structure is permanent on chain. You can add new modules and lessons later via the Account page, but you cannot edit or delete existing ones.

### Managing a published course

Open the **Account** page and click **Manage** on any course you teach.

- The **Add module** form posts `addModule(courseId, title, description)`.
- For every existing module, an **Add lesson** form hosts a full editor. Submitting it sanitizes the HTML, uploads it to IPFS, computes the integrity hash, and posts `addLesson(...)`.

### Marking a student complete

When a student finishes every lesson, a completion CTA appears on their detail page. Since the contract requires the instructor to mark completion, you must visit the same course detail page from your instructor wallet — the CTA is enabled for you. After the `markComplete` transaction is mined, the platform owner mints the soulbound certificate.

### Claiming payments

Enrolled ETH is held by the contract until the instructor calls `claimPayment(courseId)`. The full pending amount is transferred to the instructor wallet in one transaction.

## Theme

The top-right ☀ / ☾ button toggles between dark and light themes. The choice is saved in `localStorage` and applied on every page reload.

## Troubleshooting

- **MetaMask is on chain N, but this app uses chain 31337** — switch the network in MetaMask to the LearnChain network. Delete any stale "Localhost 8545" entries and add the network with `Chain ID 31337` and `RPC URL http://localhost:8545`.
- **Nonce too high** — the local chain was restarted. In MetaMask: Settings → Advanced → Clear activity tab data (reset account).
- **Insufficient funds** — import one of the test accounts Hardhat prints on startup (each has 10,000 ETH).
- **Content integrity warning** — the lesson HTML on IPFS no longer matches the on-chain hash. Treat the content as untrusted; the author can re-publish.
