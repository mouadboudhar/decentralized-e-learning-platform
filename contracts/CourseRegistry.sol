// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CourseRegistry — Coursera-style course catalogue with on-chain
///        enrollment and integrity-hashed off-chain content.
/// @notice Courses are organized as Course > Module > Lesson. Lesson rich
///         text is too large for on-chain storage, so we store it on IPFS
///         and record a keccak256 hash on-chain so the frontend can verify
///         the IPFS payload has not been tampered with.
contract CourseRegistry {
    struct Course {
        uint256 id;
        address instructor;
        string ipfsHash;     // course metadata (title, description, thumbnail, …)
        uint256 price;
        bool active;
    }

    struct Module {
        string title;
        string description;
        uint256 lessonCount; // mirrors moduleLessons[courseId][index].length
    }

    struct Lesson {
        string title;
        string contentIpfsHash; // IPFS CID of the sanitized HTML payload
        bytes32 contentHash;    // keccak256 of the sanitized HTML for integrity
        uint256 estimatedMinutes;
        uint256 lessonIndex;    // position within its module
    }

    uint256 public courseCount;

    mapping(uint256 => Course) public courses;
    mapping(uint256 => mapping(address => bool)) public enrolled;
    mapping(uint256 => mapping(address => bool)) public completed;
    mapping(uint256 => uint256) public pendingPayments;

    mapping(uint256 => Module[]) private courseModules;
    mapping(uint256 => mapping(uint256 => Lesson[])) private moduleLessons;
    mapping(uint256 => uint256) private totalLessons;

    event CourseCreated(uint256 indexed courseId, address indexed instructor, string ipfsHash, uint256 price);
    event StudentEnrolled(uint256 indexed courseId, address indexed student);
    event CourseCompleted(uint256 indexed courseId, address indexed student);
    event PaymentClaimed(uint256 indexed courseId, address indexed instructor, uint256 amount);
    event ModuleAdded(uint256 indexed courseId, uint256 indexed moduleIndex, string title);
    event LessonAdded(
        uint256 indexed courseId,
        uint256 indexed moduleIndex,
        uint256 indexed lessonIndex,
        string title,
        string contentIpfsHash,
        bytes32 contentHash
    );

    modifier onlyInstructor(uint256 courseId) {
        require(courses[courseId].id != 0, "Course does not exist");
        require(msg.sender == courses[courseId].instructor, "Not instructor");
        _;
    }

    // ── Courses ─────────────────────────────────────────────────────────

    function createCourse(string calldata ipfsHash, uint256 price) external returns (uint256) {
        courseCount++;
        courses[courseCount] = Course({
            id: courseCount,
            instructor: msg.sender,
            ipfsHash: ipfsHash,
            price: price,
            active: true
        });
        emit CourseCreated(courseCount, msg.sender, ipfsHash, price);
        return courseCount;
    }

    function enroll(uint256 courseId) external payable {
        Course storage course = courses[courseId];
        require(course.active, "Course not active");
        require(!enrolled[courseId][msg.sender], "Already enrolled");
        require(msg.value >= course.price, "Insufficient payment");

        enrolled[courseId][msg.sender] = true;
        pendingPayments[courseId] += msg.value;

        emit StudentEnrolled(courseId, msg.sender);
    }

    function markComplete(uint256 courseId, address student) external {
        Course storage course = courses[courseId];
        require(msg.sender == course.instructor, "Not instructor");
        require(enrolled[courseId][student], "Student not enrolled");
        require(!completed[courseId][student], "Already completed");

        completed[courseId][student] = true;
        emit CourseCompleted(courseId, student);
    }

    function claimPayment(uint256 courseId) external {
        Course storage course = courses[courseId];
        require(msg.sender == course.instructor, "Not instructor");

        uint256 amount = pendingPayments[courseId];
        pendingPayments[courseId] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit PaymentClaimed(courseId, msg.sender, amount);
    }

    function isEnrolled(uint256 courseId, address student) external view returns (bool) {
        return enrolled[courseId][student];
    }

    function isCompleted(uint256 courseId, address student) external view returns (bool) {
        return completed[courseId][student];
    }

    // ── Modules ─────────────────────────────────────────────────────────

    function addModule(
        uint256 courseId,
        string calldata title,
        string calldata description
    ) external onlyInstructor(courseId) returns (uint256) {
        courseModules[courseId].push(Module({
            title: title,
            description: description,
            lessonCount: 0
        }));
        uint256 moduleIndex = courseModules[courseId].length - 1;
        emit ModuleAdded(courseId, moduleIndex, title);
        return moduleIndex;
    }

    function getModule(uint256 courseId, uint256 moduleIndex)
        external
        view
        returns (Module memory)
    {
        require(moduleIndex < courseModules[courseId].length, "Module does not exist");
        return courseModules[courseId][moduleIndex];
    }

    function getModuleCount(uint256 courseId) external view returns (uint256) {
        return courseModules[courseId].length;
    }

    // ── Lessons ─────────────────────────────────────────────────────────

    function addLesson(
        uint256 courseId,
        uint256 moduleIndex,
        string calldata title,
        string calldata contentIpfsHash,
        bytes32 contentHash,
        uint256 estimatedMinutes
    ) external onlyInstructor(courseId) returns (uint256) {
        require(moduleIndex < courseModules[courseId].length, "Module does not exist");

        Lesson[] storage lessons = moduleLessons[courseId][moduleIndex];
        uint256 lessonIndex = lessons.length;

        lessons.push(Lesson({
            title: title,
            contentIpfsHash: contentIpfsHash,
            contentHash: contentHash,
            estimatedMinutes: estimatedMinutes,
            lessonIndex: lessonIndex
        }));

        courseModules[courseId][moduleIndex].lessonCount = lessons.length;
        totalLessons[courseId] += 1;

        emit LessonAdded(courseId, moduleIndex, lessonIndex, title, contentIpfsHash, contentHash);
        return lessonIndex;
    }

    function getLesson(uint256 courseId, uint256 moduleIndex, uint256 lessonIndex)
        external
        view
        returns (Lesson memory)
    {
        require(moduleIndex < courseModules[courseId].length, "Module does not exist");
        Lesson[] storage lessons = moduleLessons[courseId][moduleIndex];
        require(lessonIndex < lessons.length, "Lesson does not exist");
        return lessons[lessonIndex];
    }

    function getLessonCount(uint256 courseId, uint256 moduleIndex)
        external
        view
        returns (uint256)
    {
        require(moduleIndex < courseModules[courseId].length, "Module does not exist");
        return moduleLessons[courseId][moduleIndex].length;
    }

    function getTotalLessons(uint256 courseId) external view returns (uint256) {
        return totalLessons[courseId];
    }
}
