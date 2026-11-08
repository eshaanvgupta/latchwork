// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/ILatchworkTypes.sol";
import "./SettlementVault.sol";
import "./CircuitPolicyRegistry.sol";

contract AgreementFactory is Ownable2Step, ILatchworkTypes {
    SettlementVault public immutable vault;
    CircuitPolicyRegistry public immutable policyRegistry;
    address public settlementEngine;

    mapping(bytes32 => ServiceAgreement) public agreements;
    bytes32[] public agreementList;

    mapping(address => bytes32[]) public customerAgreements;
    mapping(address => bytes32[]) public providerAgreements;
    mapping(address => uint256) public userNonces;

    event AgreementCreated(
        bytes32 indexed agreementId,
        address indexed customer,
        address indexed provider,
        address token,
        uint256 totalFunded,
        uint256 epochPrice,
        uint256 epochDuration,
        bytes32 circuitPolicyId
    );
    event EscrowTopUp(bytes32 indexed agreementId, uint256 amountAdded, uint256 newTotal);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidPolicy();
    error AgreementNotFound();
    error AgreementNotActive();
    error UnauthorizedCaller();

    constructor(
        address initialOwner,
        address _vault,
        address _policyRegistry
    ) Ownable(initialOwner) {
        if (_vault == address(0) || _policyRegistry == address(0)) revert InvalidAddress();
        vault = SettlementVault(_vault);
        policyRegistry = CircuitPolicyRegistry(_policyRegistry);
    }

    function createAgreement(
        address provider,
        address token,
        uint256 depositAmount,
        uint256 epochPrice,
        uint256 epochDuration,
        bytes32 circuitPolicyId
    ) external returns (bytes32 agreementId) {
        if (provider == address(0) || token == address(0) || provider == msg.sender) {
            revert InvalidAddress();
        }
        if (depositAmount == 0 || epochPrice == 0 || depositAmount < epochPrice || epochDuration < 60) {
            revert InvalidAmount();
        }
        if (!policyRegistry.isPolicyActive(circuitPolicyId)) revert InvalidPolicy();

        uint256 nonce = userNonces[msg.sender]++;
        agreementId = keccak256(
            abi.encode(msg.sender, provider, token, epochPrice, epochDuration, nonce, block.chainid)
        );

        agreements[agreementId] = ServiceAgreement({
            id: agreementId,
            customer: msg.sender,
            provider: provider,
            token: token,
            totalFunded: depositAmount,
            spentAmount: 0,
            refundedAmount: 0,
            epochPrice: epochPrice,
            epochDuration: epochDuration,
            currentEpoch: 1,
            startTime: block.timestamp,
            circuitPolicyId: circuitPolicyId,
            status: AgreementStatus.ACTIVE
        });

        agreementList.push(agreementId);
        customerAgreements[msg.sender].push(agreementId);
        providerAgreements[provider].push(agreementId);

        // Deposit funds directly into SettlementVault
        vault.depositEscrow(agreementId, token, msg.sender, depositAmount);

        emit AgreementCreated(
            agreementId,
            msg.sender,
            provider,
            token,
            depositAmount,
            epochPrice,
            epochDuration,
            circuitPolicyId
        );
    }

    function setSettlementEngine(address engine) external onlyOwner {
        if (engine == address(0)) revert InvalidAddress();
        settlementEngine = engine;
    }

    function recordSettlement(bytes32 agreementId, uint256 epochId, bool paidProvider) external {
        if (msg.sender != settlementEngine) revert UnauthorizedCaller();
        ServiceAgreement storage ag = agreements[agreementId];
        if (ag.id == bytes32(0)) revert AgreementNotFound();
        if (epochId != ag.currentEpoch) revert InvalidAmount();
        if (paidProvider) ag.spentAmount += ag.epochPrice;
        else ag.refundedAmount += ag.epochPrice;
        ag.currentEpoch++;
    }

    function topUpEscrow(bytes32 agreementId, uint256 amount) external {
        ServiceAgreement storage ag = agreements[agreementId];
        if (ag.id == bytes32(0)) revert AgreementNotFound();
        if (ag.status != AgreementStatus.ACTIVE) revert AgreementNotActive();
        if (amount == 0) revert InvalidAmount();

        ag.totalFunded += amount;
        vault.depositEscrow(agreementId, ag.token, msg.sender, amount);

        emit EscrowTopUp(agreementId, amount, ag.totalFunded);
    }

    function getAgreement(bytes32 agreementId) external view returns (ServiceAgreement memory) {
        ServiceAgreement memory ag = agreements[agreementId];
        if (ag.id == bytes32(0)) revert AgreementNotFound();
        return ag;
    }

    function getCustomerAgreements(address customer) external view returns (bytes32[] memory) {
        return customerAgreements[customer];
    }

    function getProviderAgreements(address provider) external view returns (bytes32[] memory) {
        return providerAgreements[provider];
    }

    function getTotalAgreementsCount() external view returns (uint256) {
        return agreementList.length;
    }
}

