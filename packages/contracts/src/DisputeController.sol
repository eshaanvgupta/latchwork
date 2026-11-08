// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./AgreementFactory.sol";

interface IEpochSettlement {
    function isEpochSettled(bytes32 agreementId, uint256 epochId) external view returns (bool);
}

contract DisputeController is Ownable2Step {
    enum DisputeStatus { NONE, OPEN, UPHELD, DISMISSED }

    struct Dispute {
        bytes32 agreementId;
        uint256 epochId;
        address claimant;
        bytes32 evidenceHash;
        uint256 createdAt;
        DisputeStatus status;
    }

    uint256 public disputeWindow = 3600; // 1 hour window
    AgreementFactory public agreementFactory;
    IEpochSettlement public settlementEngine;

    // keccak256(abi.encode(agreementId, epochId)) => Dispute
    mapping(bytes32 => Dispute) public disputes;

    event DisputeOpened(bytes32 indexed agreementId, uint256 indexed epochId, address indexed claimant, bytes32 evidenceHash);
    event DisputeResolved(bytes32 indexed disputeKey, DisputeStatus indexed status);
    event DisputeWindowUpdated(uint256 oldWindow, uint256 newWindow);

    error DisputeAlreadyExists();
    error DisputeNotOpen();
    error WindowPassed();
    error InvalidDispute();

    constructor(address initialOwner) Ownable(initialOwner) {}

    function configure(address factory, address engine) external onlyOwner {
        if (factory == address(0) || engine == address(0)) revert InvalidDispute();
        agreementFactory = AgreementFactory(factory);
        settlementEngine = IEpochSettlement(engine);
    }

    function setDisputeWindow(uint256 newWindow) external onlyOwner {
        emit DisputeWindowUpdated(disputeWindow, newWindow);
        disputeWindow = newWindow;
    }

    function getDisputeKey(bytes32 agreementId, uint256 epochId) public pure returns (bytes32) {
        return keccak256(abi.encode(agreementId, epochId));
    }

    function raiseDispute(
        bytes32 agreementId,
        uint256 epochId,
        bytes32 evidenceHash,
        uint256 epochEndTime
    ) external {
        if (address(agreementFactory) == address(0)) revert InvalidDispute();
        ILatchworkTypes.ServiceAgreement memory ag = agreementFactory.getAgreement(agreementId);
        if (msg.sender != ag.customer && msg.sender != ag.provider) revert InvalidDispute();
        if (epochId == 0 || epochId != ag.currentEpoch) revert InvalidDispute();
        uint256 actualEpochEnd = ag.startTime + epochId * ag.epochDuration;
        if (epochEndTime != actualEpochEnd || block.timestamp < actualEpochEnd) revert InvalidDispute();
        if (settlementEngine.isEpochSettled(agreementId, epochId)) revert InvalidDispute();
        if (block.timestamp > epochEndTime + disputeWindow) revert WindowPassed();
        bytes32 key = getDisputeKey(agreementId, epochId);
        if (disputes[key].status != DisputeStatus.NONE) revert DisputeAlreadyExists();

        disputes[key] = Dispute({
            agreementId: agreementId,
            epochId: epochId,
            claimant: msg.sender,
            evidenceHash: evidenceHash,
            createdAt: block.timestamp,
            status: DisputeStatus.OPEN
        });

        emit DisputeOpened(agreementId, epochId, msg.sender, evidenceHash);
    }

    function resolveDispute(bytes32 agreementId, uint256 epochId, bool uphold) external onlyOwner {
        bytes32 key = getDisputeKey(agreementId, epochId);
        if (disputes[key].status != DisputeStatus.OPEN) revert DisputeNotOpen();

        DisputeStatus finalStatus = uphold ? DisputeStatus.UPHELD : DisputeStatus.DISMISSED;
        disputes[key].status = finalStatus;

        emit DisputeResolved(key, finalStatus);
    }

    function isDisputeActive(bytes32 agreementId, uint256 epochId) external view returns (bool) {
        bytes32 key = getDisputeKey(agreementId, epochId);
        // An upheld customer claim must keep the dispute input asserted too.
        return disputes[key].status == DisputeStatus.OPEN || disputes[key].status == DisputeStatus.UPHELD;
    }

    function getDisputeStatus(bytes32 agreementId, uint256 epochId) external view returns (DisputeStatus) {
        bytes32 key = getDisputeKey(agreementId, epochId);
        return disputes[key].status;
    }
}

