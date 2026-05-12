const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  const CourseRegistry = await ethers.getContractFactory("CourseRegistry");
  const courseRegistry = await CourseRegistry.deploy();
  await courseRegistry.waitForDeployment();
  const courseRegistryAddress = await courseRegistry.getAddress();
  console.log("CourseRegistry deployed to:", courseRegistryAddress);

  const CertificateNFT = await ethers.getContractFactory("CertificateNFT");
  const certificateNFT = await CertificateNFT.deploy(deployer.address);
  await certificateNFT.waitForDeployment();
  const certificateNFTAddress = await certificateNFT.getAddress();
  console.log("CertificateNFT deployed to:", certificateNFTAddress);

  const registryArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/CourseRegistry.sol/CourseRegistry.json"),
      "utf8"
    )
  );
  const nftArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/CertificateNFT.sol/CertificateNFT.json"),
      "utf8"
    )
  );

  const contractsDir = path.join(__dirname, "../frontend/src/utils");
  fs.mkdirSync(contractsDir, { recursive: true });

  fs.writeFileSync(
    path.join(contractsDir, "contracts.js"),
    `export const COURSE_REGISTRY_ADDRESS = "${courseRegistryAddress}";
export const CERTIFICATE_NFT_ADDRESS = "${certificateNFTAddress}";
export const COURSE_REGISTRY_ABI = ${JSON.stringify(registryArtifact.abi, null, 2)};
export const CERTIFICATE_NFT_ABI = ${JSON.stringify(nftArtifact.abi, null, 2)};
`
  );

  console.log("Addresses and ABIs written to frontend/src/utils/contracts.js");

  // ── Seed a few demo courses so the catalogue isn't empty on a fresh node ────
  // The chain is in-memory: every restart wipes it, so re-seed on every deploy.
  function metaHash(title, description) {
    const json = JSON.stringify({ title, description });
    return "data:application/json;base64," + Buffer.from(json).toString("base64");
  }

  const demoCourses = [
    ["Solidity Fundamentals", "Smart-contract basics: types, storage, functions, events.", "0.01"],
    ["Building dApp Frontends", "Wire a React UI to on-chain contracts with ethers.js and MetaMask.", "0.02"],
    ["NFTs & Token Standards", "ERC-721/1155 deep dive, including soulbound certificates.", "0.015"],
  ];

  for (const [title, description, priceEth] of demoCourses) {
    const tx = await courseRegistry.createCourse(metaHash(title, description), ethers.parseEther(priceEth));
    await tx.wait();
    console.log(`Seeded course: ${title}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
