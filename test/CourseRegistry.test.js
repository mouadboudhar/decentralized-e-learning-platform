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

  describe("sections and lessons", function () {
    beforeEach(async function () {
      await courseRegistry.connect(instructor).createCourse("QmHash123", ethers.parseEther("0.1"));
    });

    it("only the instructor can add a section", async function () {
      await expect(
        courseRegistry.connect(other).addSection(1, "Intro")
      ).to.be.revertedWith("Not instructor");
    });

    it("addSection appends and emits SectionAdded with the right index", async function () {
      await expect(
        courseRegistry.connect(instructor).addSection(1, "Intro")
      )
        .to.emit(courseRegistry, "SectionAdded")
        .withArgs(1, 0, "Intro");

      await expect(
        courseRegistry.connect(instructor).addSection(1, "Advanced")
      )
        .to.emit(courseRegistry, "SectionAdded")
        .withArgs(1, 1, "Advanced");

      expect(await courseRegistry.getSectionCount(1)).to.equal(2);
      const section0 = await courseRegistry.getSection(1, 0);
      expect(section0.title).to.equal("Intro");
      expect(section0.lessons.length).to.equal(0);
    });

    it("addLesson appends to the right section and emits LessonAdded", async function () {
      await courseRegistry.connect(instructor).addSection(1, "Intro");

      await expect(
        courseRegistry.connect(instructor).addLesson(1, 0, "Hello", "Welcome to the course.")
      )
        .to.emit(courseRegistry, "LessonAdded")
        .withArgs(1, 0, 0, "Hello");

      await courseRegistry.connect(instructor).addLesson(1, 0, "Setup", "Install hardhat.");

      expect(await courseRegistry.getLessonCount(1, 0)).to.equal(2);
      const lesson = await courseRegistry.getLesson(1, 0, 1);
      expect(lesson.title).to.equal("Setup");
      expect(lesson.content).to.equal("Install hardhat.");
    });

    it("addLesson reverts when the section does not exist", async function () {
      await expect(
        courseRegistry.connect(instructor).addLesson(1, 0, "x", "y")
      ).to.be.revertedWith("Section does not exist");
    });

    it("non-instructor cannot add a lesson", async function () {
      await courseRegistry.connect(instructor).addSection(1, "Intro");
      await expect(
        courseRegistry.connect(other).addLesson(1, 0, "Hi", "Body")
      ).to.be.revertedWith("Not instructor");
    });

    it("getSection returns full lesson list", async function () {
      await courseRegistry.connect(instructor).addSection(1, "Module A");
      await courseRegistry.connect(instructor).addLesson(1, 0, "L1", "C1");
      await courseRegistry.connect(instructor).addLesson(1, 0, "L2", "C2");

      const section = await courseRegistry.getSection(1, 0);
      expect(section.title).to.equal("Module A");
      expect(section.lessons.length).to.equal(2);
      expect(section.lessons[0].title).to.equal("L1");
      expect(section.lessons[1].content).to.equal("C2");
    });

    it("getSection reverts for a missing section", async function () {
      await expect(courseRegistry.getSection(1, 0)).to.be.revertedWith("Section does not exist");
    });
  });
});
