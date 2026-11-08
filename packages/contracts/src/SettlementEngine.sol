// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ILatchworkTypes.sol";
import "./interfaces/ITapeOutProcessor.sol";
import "./SettlementVault.sol";
import "./WitnessRegistry.sol";
import "./CircuitPolicyRegistry.sol";
import "./DisputeController.sol";
import "./ProtocolTreasury.sol";
import "./AgreementFactory.sol";

contract SettlementEngine is Ownable2Step, ReentrancyGuard, ILatchworkTypes {
    address public immutable tapeoutProcessor;
    SettlementVault public immutable vault;
    WitnessRegistry public immutable witnessRegistry;
    CircuitPolicyRegistry public immutable policyRegistry;
    DisputeController public immutable disputeController;
    ProtocolTreasury public immutable treasury;
    AgreementFactory public immutable factory;

    // keccak256(abi.encode(agreementId, epochId)) => bool settled
    mapping(bytes32 => bool) public settledEpochs;

    event EpochSettled(
        bytes32 indexed agreementId,
        uint256 indexed epochId,
        SettlementOutcome outcome,
        bool circuitOutput,
        uint256 amountSettled,
        bytes packedInputs
    );

    error EpochAlreadySettled();
    error AgreementNotActive();
    error EscrowDepleted();
    error DisputeActive();
    error InvalidReports();
    error CircuitExecutionFailed();
    error InvalidEpoch();
    error PolicyInactive();

    constructor(
        address initialOwner,
        address _tapeoutProcessor,
        address _vault,
        address _witnessRegistry,
        address _policyRegistry,
        address _disputeController,
        address _treasury,
        address _factory
    ) Ownable(initialOwner) {
        tapeoutProcessor = _tapeoutProcessor;
        vault = SettlementVault(_vault);
        witnessRegistry = WitnessRegistry(_witnessRegistry);
        policyRegistry = CircuitPolicyRegistry(_policyRegistry);
        disputeController = DisputeController(_disputeController);
        treasury = ProtocolTreasury(_treasury);
        factory = AgreementFactory(_factory);
    }

    function isEpochSettled(bytes32 agreementId, uint256 epochId) external view returns (bool) {
        return settledEpochs[keccak256(abi.encode(agreementId, epochId))];
    }

    /**
     * Executes circuit-governed settlement for an epoch:
     * 1. Validates witness EIP-712 signatures & quorum
     * 2. Evaluates witness performance against policy SLA thresholds
     * 3. Bit-packs Boolean inputs for the TapeOut processor
     * 4. Evaluates the TapeOut circuit on-chain
     * 5. Dispatches financial settlement (payout to provider vs customer refund)
     */
    function settleEpoch(
        bytes32 agreementId,
        uint256 epochId,
        WitnessReport[] calldata reports
    ) external nonReentrant returns (SettlementOutcome outcome, bool circuitResult) {
        bytes32 epochKey = keccak256(abi.encode(agreementId, epochId));
        if (settledEpochs[epochKey]) revert EpochAlreadySettled();

        ServiceAgreement memory ag = factory.getAgreement(agreementId);
        if (ag.status != AgreementStatus.ACTIVE) revert AgreementNotActive();
        if (epochId != ag.currentEpoch) revert InvalidEpoch();
        uint256 epochStart = ag.startTime + (epochId - 1) * ag.epochDuration;
        uint256 epochEnd = epochStart + ag.epochDuration;
        // Preserve the complete challenge window before allocating funds.
        if (block.timestamp <= epochEnd + disputeController.disputeWindow()) revert InvalidEpoch();
        if (disputeController.isDisputeActive(agreementId, epochId)) revert DisputeActive();

        // All three observations are required to prevent selective omission from
        // changing the majority. Signature quorum remains configurable separately.
        if (reports.length != 3) revert InvalidReports();
        for (uint256 i = 0; i < reports.length; i++) {
            if (reports[i].measurementStart != epochStart || reports[i].measurementEnd != epochEnd) {
                revert InvalidReports();
            }
        }

        uint256 escrow = vault.agreementEscrow(agreementId);
        if (escrow < ag.epochPrice) revert EscrowDepleted();

        // 1. Validate witness signatures & quorum
        witnessRegistry.validateWitnessReports(agreementId, epochId, reports);

        // 2. Fetch circuit policy
        CircuitPolicy memory policy = policyRegistry.getPolicy(ag.circuitPolicyId);
        if (!policy.active) revert PolicyInactive();

        // 3. Prepare bit-packed inputs
        bytes memory packedInputs = _packInputs(policy, reports, ag, epochId);

        // 4. Call TapeOut processor eval on-chain
        bytes memory circuitOutputs = ITapeOutProcessor(tapeoutProcessor).eval(
            policy.circuitId,
            packedInputs
        );

        if (circuitOutputs.length == 0) revert CircuitExecutionFailed();

        // Read bit 0 of output: 1 = SLA met, 0 = SLA failed
        circuitResult = (uint8(circuitOutputs[0]) & 1) == 1;

        settledEpochs[epochKey] = true;
        factory.recordSettlement(agreementId, epochId, circuitResult);

        if (circuitResult) {
            outcome = SettlementOutcome.PAYOUT_PROVIDER;
            vault.allocatePayout(
                agreementId,
                ag.provider,
                ag.epochPrice,
                treasury.protocolFeeBps()
            );
        } else {
            outcome = SettlementOutcome.REFUND_CUSTOMER;
            vault.allocateRefund(
                agreementId,
                ag.customer,
                ag.epochPrice
            );
        }

        emit EpochSettled(
            agreementId,
            epochId,
            outcome,
            circuitResult,
            ag.epochPrice,
            packedInputs
        );
    }

    /**
     * Bit-packs inputs for the TapeOut processor:
     * - For 3-input circuit: [w1_avail_ok, w2_avail_ok, w3_avail_ok]
     * - For 5-input circuit: [w1_ok, w2_ok, w3_ok, agreement_auth, dispute_active]
     */
    function _packInputs(
        CircuitPolicy memory policy,
        WitnessReport[] calldata reports,
        ServiceAgreement memory ag,
        uint256 epochId
    ) internal view returns (bytes memory) {
        bytes memory packed = new bytes(1);
        uint8 byte0 = 0;

        if (policy.numInputs == 3) {
            // Template 1: Availability quorum
            for (uint256 i = 0; i < 3 && i < reports.length; i++) {
                if (reports[i].availabilityPpm >= policy.minAvailabilityPpm) {
                    byte0 |= uint8(uint256(1) << i);
                }
            }
        } else if (policy.numInputs == 5) {
            // Template 3: Enterprise SLA
            for (uint256 i = 0; i < 3 && i < reports.length; i++) {
                bool availOk = reports[i].availabilityPpm >= policy.minAvailabilityPpm;
                bool latOk = reports[i].p95LatencyMs <= policy.maxLatencyMs;
                if (availOk && latOk) {
                    byte0 |= uint8(uint256(1) << i);
                }
            }
            // bit 3: agreement authorized & active
            if (ag.status == AgreementStatus.ACTIVE) {
                byte0 |= uint8(uint256(1) << 3);
            }
            // bit 4: dispute active
            bool disputed = disputeController.isDisputeActive(ag.id, epochId);
            if (disputed) {
                byte0 |= uint8(uint256(1) << 4);
            }
        } else if (policy.numInputs == 6) {
            // Template 2: alternating availability and latency bits per witness.
            for (uint256 i = 0; i < 3; i++) {
                if (reports[i].availabilityPpm >= policy.minAvailabilityPpm) {
                    byte0 |= uint8(uint256(1) << (2 * i));
                }
                if (reports[i].p95LatencyMs <= policy.maxLatencyMs) {
                    byte0 |= uint8(uint256(1) << (2 * i + 1));
                }
            }
        }

        packed[0] = bytes1(byte0);
        return packed;
    }
}
