# LearnChain — Decentralized Learning Platform

LearnChain is a fully decentralized e-learning platform built on Ethereum. Instructors publish courses on-chain, students pay directly in ETH, and completion certificates are minted as **soulbound NFTs** — permanently tied to the student's wallet, non-transferable, and censorship-resistant.

No intermediaries. No platform fees taken by a company. Payments go directly from student to instructor.

## Stack

- **Smart Contracts**: Solidity ^0.8.24, Hardhat, OpenZeppelin
- **Frontend**: React 18, Vite, ethers.js v6, TailwindCSS, react-router-dom
- **Wallet**: MetaMask via `window.ethereum`
- **Metadata Storage**: IPFS via Pinata SDK (falls back to mock hash when no API key is set)

## Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd decentralized-e-learning-platform
cp .env.example .env
# Fill in your keys in .env (optional for local development)
```

### 2. Install root dependencies

```bash
npm install
```

### 3. Run the test suite

```bash
npx hardhat test
```

### 4. Start a local Hardhat node

In a separate terminal:

```bash
npx hardhat node
```

### 5. Deploy contracts to localhost

```bash
npx hardhat run scripts/deploy.js --network localhost
```

This automatically writes the deployed contract addresses and ABIs to `frontend/src/utils/contracts.js`.

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser with MetaMask installed and connected to `localhost:8545`.

## Contracts

### CourseRegistry.sol

The main registry for courses and enrollments.

- **createCourse(ipfsHash, price)** — Instructors publish a course. Metadata (title, description) is stored on IPFS; only the hash is stored on-chain.
- **enroll(courseId)** — Students pay the course price in ETH. Funds are held in the contract as pending payments for the instructor.
- **markComplete(courseId, student)** — Instructors mark a student as having completed the course.
- **claimPayment(courseId)** — Instructors withdraw accumulated enrollment payments.

### CertificateNFT.sol

An ERC-721 NFT contract that issues **soulbound** certificates.

- Extends OpenZeppelin's `ERC721` and `Ownable`.
- `transferFrom` and `safeTransferFrom` are overridden to always revert — certificates cannot be traded or transferred.
- **mint(student, courseId, ipfsHash)** — Called by the contract owner (deployer) to issue a certificate after a student completes a course.
- `tokenURI` returns `ipfs://<hash>` pointing to the certificate metadata.

## How It Works

### Enrollment Flow

1. An instructor calls `createCourse` with an IPFS hash and ETH price.
2. A student browses courses in the frontend and clicks **Enroll**, sending the required ETH.
3. The instructor calls `markComplete` for the student once the course is finished.
4. The instructor calls `claimPayment` to withdraw the collected ETH.

### Soulbound Certificate Minting

1. After marking a student complete, the platform owner mints a certificate NFT to the student's address via `CertificateNFT.mint`.
2. The NFT is permanently bound to that wallet — `transfer` calls revert with `"Soulbound: non-transferable"`.
3. Students can view their certificates in the **My Certificates** page, with a direct IPFS link to the certificate metadata.

## Environment Variables

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Deployer wallet private key (for testnet/mainnet) |
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint (e.g. from Alchemy or Infura) |
| `ETHERSCAN_API_KEY` | For contract verification on Etherscan |
| `VITE_PINATA_API_KEY` | Pinata API key for IPFS uploads |
| `VITE_PINATA_SECRET` | Pinata secret key for IPFS uploads |

All variables are optional for local development — the app uses a Hardhat local node and mock IPFS hashes when keys are not provided.
