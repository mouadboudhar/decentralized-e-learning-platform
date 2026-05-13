// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CourseRegistry {
    struct Course {
        uint256 id;
        address instructor;
        string ipfsHash;
        uint256 price;
        bool active;
    }

    struct Lesson {
        string title;
        string content;
    }

    struct Section {
        string title;
        Lesson[] lessons;
    }

    uint256 public courseCount;

    mapping(uint256 => Course) public courses;
    mapping(uint256 => mapping(address => bool)) public enrolled;
    mapping(uint256 => mapping(address => bool)) public completed;
    mapping(uint256 => uint256) public pendingPayments;

    // courseId => sections (full struct array)
    mapping(uint256 => Section[]) private courseSections;

    event CourseCreated(uint256 indexed courseId, address indexed instructor, string ipfsHash, uint256 price);
    event StudentEnrolled(uint256 indexed courseId, address indexed student);
    event CourseCompleted(uint256 indexed courseId, address indexed student);
    event PaymentClaimed(uint256 indexed courseId, address indexed instructor, uint256 amount);
    event SectionAdded(uint256 indexed courseId, uint256 indexed sectionIndex, string title);
    event LessonAdded(uint256 indexed courseId, uint256 indexed sectionIndex, uint256 indexed lessonIndex, string title);

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

    // ─── Sections & Lessons ─────────────────────────────────────────────

    function addSection(uint256 courseId, string calldata sectionTitle) external {
        Course storage course = courses[courseId];
        require(course.id != 0, "Course does not exist");
        require(msg.sender == course.instructor, "Not instructor");

        Section storage s = courseSections[courseId].push();
        s.title = sectionTitle;

        uint256 sectionIndex = courseSections[courseId].length - 1;
        emit SectionAdded(courseId, sectionIndex, sectionTitle);
    }

    function addLesson(
        uint256 courseId,
        uint256 sectionIndex,
        string calldata lessonTitle,
        string calldata lessonContent
    ) external {
        Course storage course = courses[courseId];
        require(course.id != 0, "Course does not exist");
        require(msg.sender == course.instructor, "Not instructor");
        require(sectionIndex < courseSections[courseId].length, "Section does not exist");

        Section storage s = courseSections[courseId][sectionIndex];
        s.lessons.push(Lesson({ title: lessonTitle, content: lessonContent }));

        uint256 lessonIndex = s.lessons.length - 1;
        emit LessonAdded(courseId, sectionIndex, lessonIndex, lessonTitle);
    }

    function getSection(uint256 courseId, uint256 sectionIndex)
        external
        view
        returns (Section memory)
    {
        require(sectionIndex < courseSections[courseId].length, "Section does not exist");
        return courseSections[courseId][sectionIndex];
    }

    function getLesson(uint256 courseId, uint256 sectionIndex, uint256 lessonIndex)
        external
        view
        returns (Lesson memory)
    {
        require(sectionIndex < courseSections[courseId].length, "Section does not exist");
        Section storage s = courseSections[courseId][sectionIndex];
        require(lessonIndex < s.lessons.length, "Lesson does not exist");
        return s.lessons[lessonIndex];
    }

    function getSectionCount(uint256 courseId) external view returns (uint256) {
        return courseSections[courseId].length;
    }

    function getLessonCount(uint256 courseId, uint256 sectionIndex) external view returns (uint256) {
        require(sectionIndex < courseSections[courseId].length, "Section does not exist");
        return courseSections[courseId][sectionIndex].lessons.length;
    }
}
