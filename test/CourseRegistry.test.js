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

  describe("modules and lessons", function () {
    const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("<p>hello</p>"));

    beforeEach(async function () {
      await courseRegistry.connect(instructor).createCourse("QmHash123", ethers.parseEther("0.1"));
    });

    it("only the instructor can add a module", async function () {
      await expect(
        courseRegistry.connect(other).addModule(1, "Module 1", "Intro")
      ).to.be.revertedWith("Not instructor");
    });

    it("addModule appends and emits ModuleAdded", async function () {
      await expect(
        courseRegistry.connect(instructor).addModule(1, "Module 1", "Intro")
      )
        .to.emit(courseRegistry, "ModuleAdded")
        .withArgs(1, 0, "Module 1");

      expect(await courseRegistry.getModuleCount(1)).to.equal(1);
      const mod = await courseRegistry.getModule(1, 0);
      expect(mod.title).to.equal("Module 1");
      expect(mod.description).to.equal("Intro");
      expect(mod.lessonCount).to.equal(0);
    });

    it("addLesson appends to the right module, emits LessonAdded, and tracks counts", async function () {
      await courseRegistry.connect(instructor).addModule(1, "Module 1", "Intro");

      await expect(
        courseRegistry
          .connect(instructor)
          .addLesson(1, 0, "Hello", "QmContent1", sampleHash, 5)
      )
        .to.emit(courseRegistry, "LessonAdded")
        .withArgs(1, 0, 0, "Hello", "QmContent1", sampleHash);

      await courseRegistry
        .connect(instructor)
        .addLesson(1, 0, "Setup", "QmContent2", sampleHash, 10);

      expect(await courseRegistry.getLessonCount(1, 0)).to.equal(2);
      expect(await courseRegistry.getTotalLessons(1)).to.equal(2);

      const lesson = await courseRegistry.getLesson(1, 0, 1);
      expect(lesson.title).to.equal("Setup");
      expect(lesson.contentIpfsHash).to.equal("QmContent2");
      expect(lesson.contentHash).to.equal(sampleHash);
      expect(lesson.estimatedMinutes).to.equal(10);
      expect(lesson.lessonIndex).to.equal(1);

      const mod = await courseRegistry.getModule(1, 0);
      expect(mod.lessonCount).to.equal(2);
    });

    it("addLesson reverts when the module does not exist", async function () {
      await expect(
        courseRegistry.connect(instructor).addLesson(1, 0, "x", "Qm", sampleHash, 1)
      ).to.be.revertedWith("Module does not exist");
    });

    it("non-instructor cannot add a lesson", async function () {
      await courseRegistry.connect(instructor).addModule(1, "Module 1", "Intro");
      await expect(
        courseRegistry.connect(other).addLesson(1, 0, "Hi", "Qm", sampleHash, 1)
      ).to.be.revertedWith("Not instructor");
    });

    it("getModule and getLesson revert for missing entries", async function () {
      await expect(courseRegistry.getModule(1, 0)).to.be.revertedWith("Module does not exist");
      await courseRegistry.connect(instructor).addModule(1, "M", "D");
      await expect(courseRegistry.getLesson(1, 0, 0)).to.be.revertedWith("Lesson does not exist");
    });

    it("getTotalLessons aggregates across modules", async function () {
      await courseRegistry.connect(instructor).addModule(1, "Module 1", "");
      await courseRegistry.connect(instructor).addModule(1, "Module 2", "");
      await courseRegistry.connect(instructor).addLesson(1, 0, "A", "Q", sampleHash, 1);
      await courseRegistry.connect(instructor).addLesson(1, 0, "B", "Q", sampleHash, 1);
      await courseRegistry.connect(instructor).addLesson(1, 1, "C", "Q", sampleHash, 1);
      expect(await courseRegistry.getTotalLessons(1)).to.equal(3);
    });
  });

  describe("createCourseWithContent (batched publish)", function () {
    const hashA = ethers.keccak256(ethers.toUtf8Bytes("<p>a</p>"));
    const hashB = ethers.keccak256(ethers.toUtf8Bytes("<p>b</p>"));
    const hashC = ethers.keccak256(ethers.toUtf8Bytes("<p>c</p>"));

    it("creates course, modules, and lessons in one transaction", async function () {
      const modulesInput = [
        {
          title: "Intro",
          description: "Getting started",
          lessons: [
            { title: "L1", contentIpfsHash: "QmL1", contentHash: hashA, estimatedMinutes: 5 },
            { title: "L2", contentIpfsHash: "QmL2", contentHash: hashB, estimatedMinutes: 10 },
          ],
        },
        {
          title: "Advanced",
          description: "Deeper dive",
          lessons: [
            { title: "L3", contentIpfsHash: "QmL3", contentHash: hashC, estimatedMinutes: 15 },
          ],
        },
      ];

      const tx = await courseRegistry
        .connect(instructor)
        .createCourseWithContent("QmMeta", ethers.parseEther("0.1"), modulesInput);
      const receipt = await tx.wait();

      // Course event fires
      const courseCreated = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === "CourseCreated"
      );
      expect(courseCreated).to.not.be.undefined;
      expect(Number(courseCreated.args[0])).to.equal(1);

      // Module + lesson events fire in order
      const moduleEvents = receipt.logs.filter((l) => l.fragment?.name === "ModuleAdded");
      const lessonEvents = receipt.logs.filter((l) => l.fragment?.name === "LessonAdded");
      expect(moduleEvents.length).to.equal(2);
      expect(lessonEvents.length).to.equal(3);

      // Storage matches input
      expect(await courseRegistry.getModuleCount(1)).to.equal(2);
      expect(await courseRegistry.getLessonCount(1, 0)).to.equal(2);
      expect(await courseRegistry.getLessonCount(1, 1)).to.equal(1);
      expect(await courseRegistry.getTotalLessons(1)).to.equal(3);

      const mod0 = await courseRegistry.getModule(1, 0);
      expect(mod0.title).to.equal("Intro");
      expect(mod0.lessonCount).to.equal(2);

      const l2 = await courseRegistry.getLesson(1, 0, 1);
      expect(l2.title).to.equal("L2");
      expect(l2.contentIpfsHash).to.equal("QmL2");
      expect(l2.contentHash).to.equal(hashB);
      expect(l2.estimatedMinutes).to.equal(10);
      expect(l2.lessonIndex).to.equal(1);
    });

    it("works with no modules (metadata-only publish)", async function () {
      await courseRegistry
        .connect(instructor)
        .createCourseWithContent("QmMeta", 0, []);

      expect(await courseRegistry.getModuleCount(1)).to.equal(0);
      expect(await courseRegistry.getTotalLessons(1)).to.equal(0);
    });

    it("works with a module that has no lessons", async function () {
      const modulesInput = [{ title: "Empty", description: "", lessons: [] }];
      await courseRegistry
        .connect(instructor)
        .createCourseWithContent("QmMeta", 0, modulesInput);

      expect(await courseRegistry.getModuleCount(1)).to.equal(1);
      expect(await courseRegistry.getLessonCount(1, 0)).to.equal(0);
      expect(await courseRegistry.getTotalLessons(1)).to.equal(0);
    });

    it("the new course belongs to msg.sender (the publishing instructor)", async function () {
      await courseRegistry
        .connect(instructor)
        .createCourseWithContent("QmMeta", 0, []);
      const course = await courseRegistry.courses(1);
      expect(course.instructor).to.equal(instructor.address);
    });
  });
});
