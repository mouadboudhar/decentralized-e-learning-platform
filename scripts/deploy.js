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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
