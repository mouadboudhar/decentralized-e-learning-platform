const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateNFT", function () {
  let certificateNFT;
  let owner, student, other;

  beforeEach(async function () {
    [owner, student, other] = await ethers.getSigners();
    const CertificateNFT = await ethers.getContractFactory("CertificateNFT");
    certificateNFT = await CertificateNFT.deploy(owner.address);
    await certificateNFT.waitForDeployment();
  });

  it("should mint a certificate and set hasCertificate", async function () {
    await expect(
      certificateNFT.connect(owner).mint(student.address, 1, "QmCertHash")
    )
      .to.emit(certificateNFT, "CertificateMinted")
      .withArgs(1, student.address, 1);

    expect(await certificateNFT.hasCertificate(student.address, 1)).to.be.true;
    expect(await certificateNFT.ownerOf(1)).to.equal(student.address);
  });

  it("should return correct tokenURI with ipfs prefix", async function () {
    await certificateNFT.connect(owner).mint(student.address, 1, "QmCertHash");
    expect(await certificateNFT.tokenURI(1)).to.equal("ipfs://QmCertHash");
  });

  it("should revert transfer with soulbound message", async function () {
    await certificateNFT.connect(owner).mint(student.address, 1, "QmCertHash");

    await expect(
      certificateNFT.connect(student).transferFrom(student.address, other.address, 1)
    ).to.be.revertedWith("Soulbound: non-transferable");
  });

  it("should revert double mint for same student and course", async function () {
    await certificateNFT.connect(owner).mint(student.address, 1, "QmCertHash");

    await expect(
      certificateNFT.connect(owner).mint(student.address, 1, "QmOtherHash")
    ).to.be.revertedWith("Certificate already exists");
  });
});
