// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract FactCheckRegistry {
    enum Verdict { UNCERTAIN, REAL, FAKE }

    struct Proof {
        bytes32 resultHash;
        uint8 verdict;
        uint8 confidence;
        uint256 timestamp;
        address submitter;
    }

    mapping(bytes32 => Proof) public proofs;

    event ProofRegistered(
        bytes32 indexed resultHash,
        uint8 verdict,
        uint8 confidence,
        uint256 timestamp,
        address indexed submitter
    );

    function registerProof(bytes32 resultHash, uint8 verdict, uint8 confidence) external {
        require(resultHash != bytes32(0), 'ZERO_HASH');
        require(verdict <= uint8(Verdict.FAKE), 'INVALID_VERDICT');
        require(confidence <= 100, 'INVALID_CONFIDENCE');
        require(proofs[resultHash].timestamp == 0, 'DUPLICATE_PROOF');

        uint256 timestamp = block.timestamp;
        proofs[resultHash] = Proof(resultHash, verdict, confidence, timestamp, msg.sender);
        emit ProofRegistered(resultHash, verdict, confidence, timestamp, msg.sender);
    }
}
