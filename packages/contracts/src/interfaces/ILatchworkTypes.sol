// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ILatchworkTypes {
    enum AgreementStatus {
        INACTIVE,
        ACTIVE,
        SETTLED,
        REFUNDED,
        DISPUTED,
        TERMINATED
    }

    enum SettlementOutcome {
        REJECTED,
        PAYOUT_PROVIDER,
        REFUND_CUSTOMER,
        DISPUTE_HELD
    }

    struct ServiceAgreement {
        bytes32 id;
        address customer;
        address provider;
        address token;
        uint256 totalFunded;
        uint256 spentAmount;
        uint256 refundedAmount;
        uint256 epochPrice;
        uint256 epochDuration;
        uint256 currentEpoch;
        uint256 startTime;
        bytes32 circuitPolicyId;
        AgreementStatus status;
    }

    struct WitnessReport {
        bytes32 agreementId;
        uint256 epochId;
        uint256 chainId;
        address witness;
        uint256 measurementStart;
        uint256 measurementEnd;
        uint256 observationCount;
        uint256 availabilityPpm; // parts per million: 995,000 = 99.5%
        uint256 p95LatencyMs;
        bytes32 evidenceHash;
        uint256 reportNonce;
        uint256 deadline;
        bytes signature;
    }

    struct CircuitPolicy {
        bytes32 id;
        uint256 circuitId; // on-chain TapeOut processor circuit ID
        uint32 numInputs;
        uint32 numOutputs;
        uint256 minAvailabilityPpm;
        uint256 maxLatencyMs;
        bytes32 netlistHash;
        bool active;
    }
}

