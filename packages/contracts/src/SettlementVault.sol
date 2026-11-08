// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SettlementVault is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public settlementEngine;
    address public agreementFactory;
    address public protocolTreasury;

    // token => user => claimable amount
    mapping(address => mapping(address => uint256)) public claimableBalances;
    // token => treasury claimable amount
    mapping(address => uint256) public claimableTreasury;
    // agreementId => escrow balance
    mapping(bytes32 => uint256) public agreementEscrow;
    // agreementId => token
    mapping(bytes32 => address) public agreementToken;

    event EscrowDeposited(bytes32 indexed agreementId, address indexed token, uint256 amount);
    event SettlementAllocated(
        bytes32 indexed agreementId,
        address indexed token,
        address indexed provider,
        uint256 providerAmount,
        uint256 feeAmount
    );
    event RefundAllocated(
        bytes32 indexed agreementId,
        address indexed token,
        address indexed customer,
        uint256 amount
    );
    event FundsWithdrawn(address indexed token, address indexed user, uint256 amount);
    event TreasuryWithdrawn(address indexed token, address indexed treasury, uint256 amount);

    error UnauthorizedCaller();
    error InsufficientEscrow();
    error InsufficientBalance();
    error ZeroAmount();
    error ZeroAddress();
    error InvalidTokenTransfer();

    modifier onlyAuthorized() {
        if (msg.sender != settlementEngine && msg.sender != agreementFactory && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(address initialOwner, address _protocolTreasury) Ownable(initialOwner) {
        if (_protocolTreasury == address(0)) revert ZeroAddress();
        protocolTreasury = _protocolTreasury;
    }

    function setSettlementEngine(address _engine) external onlyOwner {
        if (_engine == address(0)) revert ZeroAddress();
        settlementEngine = _engine;
    }

    function setAgreementFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert ZeroAddress();
        agreementFactory = _factory;
    }

    function setProtocolTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        protocolTreasury = _treasury;
    }

    /**
     * Called by AgreementFactory when a customer funds an agreement escrow
     */
    function depositEscrow(
        bytes32 agreementId,
        address token,
        address payer,
        uint256 amount
    ) external onlyAuthorized nonReentrant {
        if (msg.sender != agreementFactory) revert UnauthorizedCaller();
        if (amount == 0) revert ZeroAmount();
        if (token == address(0) || payer == address(0)) revert ZeroAddress();
        if (agreementToken[agreementId] != address(0) && agreementToken[agreementId] != token) {
            revert InvalidTokenTransfer();
        }
        uint256 beforeBalance = IERC20(token).balanceOf(address(this));
        agreementToken[agreementId] = token;
        agreementEscrow[agreementId] += amount;

        IERC20(token).safeTransferFrom(payer, address(this), amount);
        if (IERC20(token).balanceOf(address(this)) - beforeBalance != amount) revert InvalidTokenTransfer();
        emit EscrowDeposited(agreementId, token, amount);
    }

    /**
     * Called by SettlementEngine to allocate payout to provider and protocol fee
     */
    function allocatePayout(
        bytes32 agreementId,
        address provider,
        uint256 amount,
        uint256 feeBps
    ) external onlyAuthorized {
        if (msg.sender != settlementEngine) revert UnauthorizedCaller();
        if (provider == address(0)) revert ZeroAddress();
        if (feeBps > 10_000) revert InvalidTokenTransfer();
        if (amount == 0) revert ZeroAmount();
        if (agreementEscrow[agreementId] < amount) revert InsufficientEscrow();

        address token = agreementToken[agreementId];
        agreementEscrow[agreementId] -= amount;

        uint256 feeAmount = (amount * feeBps) / 10000;
        uint256 providerAmount = amount - feeAmount;

        claimableBalances[token][provider] += providerAmount;
        claimableTreasury[token] += feeAmount;

        emit SettlementAllocated(agreementId, token, provider, providerAmount, feeAmount);
    }

    /**
     * Called by SettlementEngine to allocate refund to customer
     */
    function allocateRefund(
        bytes32 agreementId,
        address customer,
        uint256 amount
    ) external onlyAuthorized {
        if (msg.sender != settlementEngine) revert UnauthorizedCaller();
        if (customer == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (agreementEscrow[agreementId] < amount) revert InsufficientEscrow();

        address token = agreementToken[agreementId];
        agreementEscrow[agreementId] -= amount;

        claimableBalances[token][customer] += amount;

        emit RefundAllocated(agreementId, token, customer, amount);
    }

    /**
     * Users withdraw their claimable funds (pull pattern)
     */
    function withdraw(address token) external nonReentrant {
        uint256 amount = claimableBalances[token][msg.sender];
        if (amount == 0) revert InsufficientBalance();

        claimableBalances[token][msg.sender] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit FundsWithdrawn(token, msg.sender, amount);
    }

    /**
     * Protocol treasury withdraws accumulated fees
     */
    function withdrawTreasury(address token) external nonReentrant {
        uint256 amount = claimableTreasury[token];
        if (amount == 0) revert InsufficientBalance();

        claimableTreasury[token] = 0;
        IERC20(token).safeTransfer(protocolTreasury, amount);

        emit TreasuryWithdrawn(token, protocolTreasury, amount);
    }
}

