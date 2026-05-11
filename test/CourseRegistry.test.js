const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CourseRegistry", function () {
  let courseRegistry;
  let owner, instructor, student, other;

  beforeEach(async function () {
    [owner, instructor, student, other] = await ethers.getSigners();
    const CourseRegistry = await ethers.getContractFactory("CourseRegistry");
    courseRegistry = await CourseRegistry.deploy();
    await courseRegistry.waitForDeployment();
  });

  it("should create a course and emit CourseCreated event", async function () {
    await expect(
      courseRegistry.connect(instructor).createCourse("QmHash123", ethers.parseEther("0.1"))
    )
      .to.emit(courseRegistry, "CourseCreated")
      .withArgs(1, instructor.address, "QmHash123", ethers.parseEther("0.1"));

    expect(await courseRegistry.courseCount()).to.equal(1);
    const course = await courseRegistry.courses(1);
    expect(course.instructor).to.equal(instructor.address);
    expect(course.ipfsHash).to.equal("QmHash123");
    expect(course.price).to.equal(ethers.parseEther("0.1"));
    expect(course.active).to.be.true;
  });

  it("should enroll a student with correct ETH", async function () {
    await courseRegistry.connect(instructor).createCourse("QmHash123", ethers.parseEther("0.1"));

    await expect(
      courseRegistry.connect(student).enroll(1, { value: ethers.parseEther("0.1") })
    )
      .to.emit(courseRegistry, "StudentEnrolled")
      .withArgs(1, student.address);

    expect(await courseRegistry.isEnrolled(1, student.address)).to.be.true;
  });

  it("should revert enrollment with insufficient ETH", async function () {
    await courseRegistry.connect(instructor).createCourse("QmHash123", ethers.parseEther("0.1"));

    await expect(
      courseRegistry.connect(student).enroll(1, { value: ethers.parseEther("0.05") })
    ).to.be.revertedWith("Insufficient payment");
  });

  it("should revert double enrollment", async function () {
    await courseRegistry.connect(instructor).createCourse("QmHash123", ethers.parseEther("0.1"));
    await courseRegistry.connect(student).enroll(1, { value: ethers.parseEther("0.1") });

    await expect(
      courseRegistry.connect(student).enroll(1, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Already enrolled");
  });

  it("should revert markComplete by non-instructor", async function () {
    await courseRegistry.connect(instructor).createCourse("QmHash123", ethers.parseEther("0.1"));
    await courseRegistry.connect(student).enroll(1, { value: ethers.parseEther("0.1") });

    await expect(
      courseRegistry.connect(other).markComplete(1, student.address)
    ).to.be.revertedWith("Not instructor");
  });

  it("should allow instructor to mark a student complete", async function () {
    await courseRegistry.connect(instructor).createCourse("QmHash123", ethers.parseEther("0.1"));
    await courseRegistry.connect(student).enroll(1, { value: ethers.parseEther("0.1") });

    await expect(
      courseRegistry.connect(instructor).markComplete(1, student.address)
    )
      .to.emit(courseRegistry, "CourseCompleted")
      .withArgs(1, student.address);

    expect(await courseRegistry.isCompleted(1, student.address)).to.be.true;
  });

  it("should transfer ETH to instructor on claimPayment", async function () {
    await courseRegistry.connect(instructor).createCourse("QmHash123", ethers.parseEther("0.1"));
    await courseRegistry.connect(student).enroll(1, { value: ethers.parseEther("0.1") });

    const balanceBefore = await ethers.provider.getBalance(instructor.address);
    const tx = await courseRegistry.connect(instructor).claimPayment(1);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * tx.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(instructor.address);

    expect(balanceAfter).to.be.greaterThan(balanceBefore - gasUsed);
    expect(await courseRegistry.pendingPayments(1)).to.equal(0);
  });
});
