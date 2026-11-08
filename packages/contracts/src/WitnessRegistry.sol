// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/ILatchworkTypes.sol";

contract WitnessRegistry is Ownable2Step, EIP712, ILatchworkTypes {
    using ECDSA for bytes32;

    bytes32 public constant WITNESS_REPORT_TYPEHASH = keccak256(
        "WitnessEpochReport(bytes32 agreementId,uint256 epochId,uint256 chainId,address witness,uint256 measurementStart,uint256 measurementEnd,uint256 observationCount,uint256 availabilityPpm,uint256 p95LatencyMs,bytes32 evidenceHash,uint256 reportNonce,uint256 deadline)"
    );

    uint256 public quorumRequired = 2;
    mapping(address => bool) public isAuthorizedWitness;
    address[] public authorizedWitnessList;

    address public settlementEngine;
    // Nonces belong to each signing identity, not to the ordering of a batch.
    mapping(bytes32 => mapping(address => uint256)) public lastReportNonce;
    // hash(report) => used
    mapping(bytes32 => bool) public executedReports;

    event WitnessAuthorized(address indexed witness);
    event WitnessRevoked(address indexed witness);
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);

    error UnauthorizedWitness(address witness);
    error InsufficientQuorum();
    error DuplicateWitness(address witness);
    error InvalidSignature();
    error ReportExpired();
    error InvalidChainId();
    error NonceTooLow();
    error ReportAlreadyExecuted();
    error UnauthorizedCaller();
    error InvalidMeasurements();

    constructor(address initialOwner)
        Ownable(initialOwner)
        EIP712("LatchworkWitnessNetwork", "1")
    {}

    function setSettlementEngine(address engine) external onlyOwner {
        if (engine == address(0)) revert UnauthorizedCaller();
        settlementEngine = engine;
    }

    function setQuorum(uint256 newQuorum) external onlyOwner {
        if (newQuorum == 0 || newQuorum > authorizedWitnessList.length) revert InsufficientQuorum();
        emit QuorumUpdated(quorumRequired, newQuorum);
        quorumRequired = newQuorum;
    }

    function authorizeWitness(address witness) external onlyOwner {
        if (witness == address(0)) revert UnauthorizedWitness(witness);
        if (!isAuthorizedWitness[witness]) {
            isAuthorizedWitness[witness] = true;
            authorizedWitnessList.push(witness);
            emit WitnessAuthorized(witness);
        }
    }

    function revokeWitness(address witness) external onlyOwner {
        if (isAuthorizedWitness[witness]) {
            isAuthorizedWitness[witness] = false;
            // Remove from list
            for (uint256 i = 0; i < authorizedWitnessList.length; i++) {
                if (authorizedWitnessList[i] == witness) {
                    authorizedWitnessList[i] = authorizedWitnessList[authorizedWitnessList.length - 1];
                    authorizedWitnessList.pop();
                    break;
                }
            }
            emit WitnessRevoked(witness);
        }
    }

    function getAuthorizedWitnessCount() external view returns (uint256) {
        return authorizedWitnessList.length;
    }

    function hashWitnessReport(WitnessReport calldata r) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    WITNESS_REPORT_TYPEHASH,
                    r.agreementId,
                    r.epochId,
                    r.chainId,
                    r.witness,
                    r.measurementStart,
                    r.measurementEnd,
                    r.observationCount,
                    r.availabilityPpm,
                    r.p95LatencyMs,
                    r.evidenceHash,
                    r.reportNonce,
                    r.deadline
                )
            )
        );
    }

    /**
     * Validates a batch of witness reports:
     * - Must satisfy quorumRequired
     * - Distinct authorized witnesses
     * - Valid EIP-712 signatures
     * - Not expired and matches current chainId
     */
    function validateWitnessReports(
        bytes32 agreementId,
        uint256 epochId,
        WitnessReport[] calldata reports
    ) external returns (bool) {
        if (msg.sender != settlementEngine) revert UnauthorizedCaller();
        if (reports.length < quorumRequired) revert InsufficientQuorum();

        address[] memory seen = new address[](reports.length);

        for (uint256 i = 0; i < reports.length; i++) {
            WitnessReport calldata r = reports[i];

            if (r.agreementId != agreementId) revert UnauthorizedWitness(r.witness);
            if (r.epochId != epochId) revert UnauthorizedWitness(r.witness);
            if (r.chainId != block.chainid) revert InvalidChainId();
            if (block.timestamp > r.deadline) revert ReportExpired();
            if (
                r.measurementStart >= r.measurementEnd ||
                r.measurementEnd > block.timestamp ||
                r.observationCount == 0 ||
                r.availabilityPpm > 1_000_000
            ) revert InvalidMeasurements();
            if (!isAuthorizedWitness[r.witness]) revert UnauthorizedWitness(r.witness);

            // Check duplicate witness
            for (uint256 j = 0; j < i; j++) {
                if (seen[j] == r.witness) revert DuplicateWitness(r.witness);
            }
            seen[i] = r.witness;

            bytes32 digest = hashWitnessReport(r);
            if (executedReports[digest]) revert ReportAlreadyExecuted();
            executedReports[digest] = true;

            address recovered = ECDSA.recover(digest, r.signature);
            if (recovered != r.witness) revert InvalidSignature();

            if (r.reportNonce <= lastReportNonce[agreementId][r.witness]) {
                revert NonceTooLow();
            }
            lastReportNonce[agreementId][r.witness] = r.reportNonce;
        }

        return true;
    }
}

