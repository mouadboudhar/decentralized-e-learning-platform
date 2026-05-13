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
  function dataUri(mime, body) {
    return `data:${mime};base64,` + Buffer.from(body).toString("base64");
  }

  function metaHash(meta) {
    return dataUri("application/json", JSON.stringify(meta));
  }

  function contentUri(html) {
    return dataUri("text/html", html);
  }

  function keccak(text) {
    return ethers.keccak256(ethers.toUtf8Bytes(text));
  }

  const demoCourses = [
    {
      title: "Solidity Fundamentals",
      description: "Smart-contract basics: types, storage, functions, events.",
      thumbnail: "",
      difficulty: "Beginner",
      estimatedHours: 6,
      tags: ["solidity", "ethereum"],
      price: "0.01",
      modules: [
        {
          title: "Getting Started",
          description: "The mental model behind Ethereum.",
          lessons: [
            { title: "What is a smart contract?", minutes: 8, html: "<p>A smart contract is code that runs on Ethereum.</p>" },
            { title: "Solidity types", minutes: 12, html: "<p>uint, address, bytes32, mappings, structs.</p>" },
          ],
        },
      ],
    },
    {
      title: "Building dApp Frontends",
      description: "Wire a React UI to on-chain contracts with ethers.js and MetaMask.",
      thumbnail: "",
      difficulty: "Intermediate",
      estimatedHours: 5,
      tags: ["react", "ethers"],
      price: "0.02",
      modules: [
        {
          title: "Reading from a contract",
          description: "Set up a read-only provider and query state.",
          lessons: [
            { title: "JsonRpcProvider", minutes: 10, html: "<p>Use ethers.JsonRpcProvider for read-only queries.</p>" },
          ],
        },
      ],
    },
    {
      title: "NFTs & Token Standards",
      description: "ERC-721/1155 deep dive, including soulbound certificates.",
      thumbnail: "",
      difficulty: "Advanced",
      estimatedHours: 8,
      tags: ["nft", "erc721"],
      price: "0.015",
      modules: [],
    },
  ];

  for (const course of demoCourses) {
    const meta = {
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      difficulty: course.difficulty,
      estimatedHours: course.estimatedHours,
      tags: course.tags,
    };
    const tx = await courseRegistry.createCourse(metaHash(meta), ethers.parseEther(course.price));
    const receipt = await tx.wait();
    const courseId = Number(receipt.logs[0].args[0]);

    for (let m = 0; m < course.modules.length; m++) {
      const mod = course.modules[m];
      await (await courseRegistry.addModule(courseId, mod.title, mod.description)).wait();
      for (const lesson of mod.lessons) {
        await (await courseRegistry.addLesson(
          courseId,
          m,
          lesson.title,
          contentUri(lesson.html),
          keccak(lesson.html),
          lesson.minutes
        )).wait();
      }
    }
    console.log(`Seeded course: ${course.title} (#${courseId})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
