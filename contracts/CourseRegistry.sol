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

    uint256 public courseCount;

    mapping(uint256 => Course) public courses;
    mapping(uint256 => mapping(address => bool)) public enrolled;
    mapping(uint256 => mapping(address => bool)) public completed;
    mapping(uint256 => uint256) public pendingPayments;

    event CourseCreated(uint256 indexed courseId, address indexed instructor, string ipfsHash, uint256 price);
    event StudentEnrolled(uint256 indexed courseId, address indexed student);
    event CourseCompleted(uint256 indexed courseId, address indexed student);
    event PaymentClaimed(uint256 indexed courseId, address indexed instructor, uint256 amount);

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
}
