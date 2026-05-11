// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CertificateNFT is ERC721, Ownable {
    struct Certificate {
        address student;
        uint256 courseId;
        uint256 issuedAt;
        string ipfsHash;
    }

    uint256 private _tokenIdCounter;

    mapping(uint256 => Certificate) public certificates;
    mapping(address => mapping(uint256 => bool)) public hasCertificate;

    event CertificateMinted(uint256 indexed tokenId, address indexed student, uint256 indexed courseId);

    constructor(address initialOwner) ERC721("LearnChain Certificate", "LCERT") Ownable(initialOwner) {}

    function transferFrom(address, address, uint256) public pure override {
        revert("Soulbound: non-transferable");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("Soulbound: non-transferable");
    }

    function mint(address student, uint256 courseId, string calldata ipfsHash) external onlyOwner {
        require(!hasCertificate[student][courseId], "Certificate already exists");

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _mint(student, tokenId);

        certificates[tokenId] = Certificate({
            student: student,
            courseId: courseId,
            issuedAt: block.timestamp,
            ipfsHash: ipfsHash
        });

        hasCertificate[student][courseId] = true;

        emit CertificateMinted(tokenId, student, courseId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked("ipfs://", certificates[tokenId].ipfsHash));
    }
}
