// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/ILatchworkTypes.sol";
import "./interfaces/ITapeOutProcessor.sol";

contract CircuitPolicyRegistry is Ownable2Step, ILatchworkTypes {
    address public immutable tapeoutProcessor;

    mapping(bytes32 => CircuitPolicy) public policies;
    bytes32[] public policyList;

    event PolicyRegistered(
        bytes32 indexed policyId,
        uint256 indexed circuitId,
        uint256 minAvailabilityPpm,
        uint256 maxLatencyMs
    );
    event PolicyStatusUpdated(bytes32 indexed policyId, bool active);

    error PolicyAlreadyExists(bytes32 policyId);
    error PolicyNotFound(bytes32 policyId);
    error InvalidCircuit(uint256 circuitId);
    error PolicyInactive(bytes32 policyId);

    constructor(address initialOwner, address _tapeoutProcessor) Ownable(initialOwner) {
        tapeoutProcessor = _tapeoutProcessor;
    }

    function registerPolicy(
        bytes32 policyId,
        uint256 circuitId,
        uint256 minAvailabilityPpm,
        uint256 maxLatencyMs,
        bytes32 netlistHash
    ) external onlyOwner {
        if (policyId == bytes32(0) || minAvailabilityPpm > 1_000_000) revert InvalidCircuit(circuitId);
        if (policies[policyId].id != bytes32(0)) revert PolicyAlreadyExists(policyId);

        // Verify circuit exists on TapeOut processor
        (uint32 inputs, uint32 outputs, uint32 state, ) = ITapeOutProcessor(tapeoutProcessor).circuitInfo(circuitId);
        // Settlement supports these explicit, stateless template input layouts only.
        if ((inputs != 3 && inputs != 5 && inputs != 6) || outputs != 1 || state != 0) {
            revert InvalidCircuit(circuitId);
        }
        if (keccak256(ITapeOutProcessor(tapeoutProcessor).netlist(circuitId)) != netlistHash) {
            revert InvalidCircuit(circuitId);
        }

        policies[policyId] = CircuitPolicy({
            id: policyId,
            circuitId: circuitId,
            numInputs: inputs,
            numOutputs: outputs,
            minAvailabilityPpm: minAvailabilityPpm,
            maxLatencyMs: maxLatencyMs,
            netlistHash: netlistHash,
            active: true
        });

        policyList.push(policyId);
        emit PolicyRegistered(policyId, circuitId, minAvailabilityPpm, maxLatencyMs);
    }

    function setPolicyStatus(bytes32 policyId, bool active) external onlyOwner {
        if (policies[policyId].id == bytes32(0)) revert PolicyNotFound(policyId);
        policies[policyId].active = active;
        emit PolicyStatusUpdated(policyId, active);
    }

    function getPolicy(bytes32 policyId) external view returns (CircuitPolicy memory) {
        CircuitPolicy memory p = policies[policyId];
        if (p.id == bytes32(0)) revert PolicyNotFound(policyId);
        return p;
    }

    function isPolicyActive(bytes32 policyId) external view returns (bool) {
        return policies[policyId].active;
    }

    function getPolicyCount() external view returns (uint256) {
        return policyList.length;
    }
}

