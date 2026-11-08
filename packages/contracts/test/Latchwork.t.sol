// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/MockUSDC.sol";
import "../src/MockTapeOutProcessor.sol";
import "../src/ProtocolTreasury.sol";
import "../src/WitnessRegistry.sol";
import "../src/CircuitPolicyRegistry.sol";
import "../src/DisputeController.sol";
import "../src/SettlementVault.sol";
import "../src/AgreementFactory.sol";
import "../src/SettlementEngine.sol";

contract LatchworkTest is Test, ILatchworkTypes {
    MockUSDC public usdc;
    MockTapeOutProcessor public tapeout;
    ProtocolTreasury public treasury;
    WitnessRegistry public witnessRegistry;
    CircuitPolicyRegistry public policyRegistry;
    DisputeController public disputeController;
    SettlementVault public vault;
    AgreementFactory public factory;
    SettlementEngine public engine;

    address public owner = address(0xAA);
    address public treasuryWallet = address(0xBB);
    address public provider = address(0x11);
    address public customer = address(0x22);

    uint256 public witness1Key = 0x101;
    uint256 public witness2Key = 0x102;
    uint256 public witness3Key = 0x103;
    address public witness1;
    address public witness2;
    address public witness3;

    bytes32 public policyId;
    uint256 public circuitId;
    bytes32 public agreementId;

    uint256 public constant DEPOSIT_AMOUNT = 1000 * 1e6; // 1,000 USDC
    uint256 public constant EPOCH_PRICE = 100 * 1e6;    // 100 USDC per epoch
    uint256 public constant EPOCH_DURATION = 3600;     // 1 hour
    uint256 public constant SLA_UPTIME_PPM = 995000;   // 99.5%
    uint256 public constant SLA_LATENCY_MS = 250;      // 250 ms

    function setUp() public {
        vm.warp(1700000000);
        vm.deal(owner, 10 ether);
        vm.startPrank(owner);

        witness1 = vm.addr(witness1Key);
        witness2 = vm.addr(witness2Key);
        witness3 = vm.addr(witness3Key);

        usdc = new MockUSDC();
        tapeout = new MockTapeOutProcessor();
        treasury = new ProtocolTreasury(owner, treasuryWallet);
        witnessRegistry = new WitnessRegistry(owner);
        policyRegistry = new CircuitPolicyRegistry(owner, address(tapeout));
        disputeController = new DisputeController(owner);
        vault = new SettlementVault(owner, address(treasury));
        factory = new AgreementFactory(owner, address(vault), address(policyRegistry));
        engine = new SettlementEngine(
            owner,
            address(tapeout),
            address(vault),
            address(witnessRegistry),
            address(policyRegistry),
            address(disputeController),
            address(treasury),
            address(factory)
        );

        // Authorize engine and factory on vault
        vault.setSettlementEngine(address(engine));
        vault.setAgreementFactory(address(factory));
        witnessRegistry.setSettlementEngine(address(engine));
        factory.setSettlementEngine(address(engine));
        disputeController.configure(address(factory), address(engine));

        // Authorize 3 witnesses
        witnessRegistry.authorizeWitness(witness1);
        witnessRegistry.authorizeWitness(witness2);
        witnessRegistry.authorizeWitness(witness3);

        // Deploy a 3-input Majority Quorum (2-of-3) circuit onto MockTapeOutProcessor
        // Netlist for Majority3: (A & B) | (B & C) | (A & C)
        // Let's create the netlist using the exact 7-byte NAND gates:
        // W0 = 0, W1 = 1, W2 = in0, W3 = in1, W4 = in2
        // G0 (W5): NAND(W2, W3)  -> NAND(A, B)
        // G1 (W6): NAND(W5, W5)  -> AND(A, B)
        // G2 (W7): NAND(W3, W4)  -> NAND(B, C)
        // G3 (W8): NAND(W7, W7)  -> AND(B, C)
        // G4 (W9): NAND(W2, W4)  -> NAND(A, C)
        // G5 (W10): NAND(W9, W9) -> AND(A, C)
        // G6 (W11): NAND(W6, W6) -> NOT(AB)
        // G7 (W12): NAND(W8, W8) -> NOT(BC)
        // G8 (W13): NAND(W11, W12) -> OR(AB, BC)
        // G9 (W14): NAND(W13, W13) -> NOT(OR(AB, BC))
        // G10 (W15): NAND(W10, W10) -> NOT(AC)
        // G11 (W16): NAND(W14, W15) -> OR((AB | BC), AC) -> Primary Output!
        bytes memory netlist = _buildMajority3Netlist();
        circuitId = tapeout.tapeout{value: 0.0013 ether}(netlist, 3, 1);

        // Register Circuit Policy
        policyId = keccak256("POLICY_AVAILABILITY_QUORUM_2_OF_3");
        policyRegistry.registerPolicy(
            policyId,
            circuitId,
            SLA_UPTIME_PPM,
            SLA_LATENCY_MS,
            keccak256(netlist)
        );

        vm.stopPrank();

        // Setup customer with USDC
        usdc.mint(customer, 10000 * 1e6);
        vm.startPrank(customer);
        usdc.approve(address(vault), type(uint256).max);

        // Create Agreement
        agreementId = factory.createAgreement(
            provider,
            address(usdc),
            DEPOSIT_AMOUNT,
            EPOCH_PRICE,
            EPOCH_DURATION,
            policyId
        );
        vm.stopPrank();
        vm.warp(block.timestamp + EPOCH_DURATION + disputeController.disputeWindow() + 1);
    }

    function _buildMajority3Netlist() internal pure returns (bytes memory) {
        // 12 gates * 7 bytes = 84 bytes
        bytes memory nl = new bytes(84);
        uint24[2][12] memory gates = [
            [uint24(2), uint24(3)],   // G0: NAND(A, B) -> wire 5
            [uint24(5), uint24(5)],   // G1: NAND(G0, G0) = AND(A, B) -> wire 6
            [uint24(3), uint24(4)],   // G2: NAND(B, C) -> wire 7
            [uint24(7), uint24(7)],   // G3: NAND(G2, G2) = AND(B, C) -> wire 8
            [uint24(2), uint24(4)],   // G4: NAND(A, C) -> wire 9
            [uint24(9), uint24(9)],   // G5: NAND(G4, G4) = AND(A, C) -> wire 10
            [uint24(6), uint24(6)],   // G6: NOT(G1) -> wire 11
            [uint24(8), uint24(8)],   // G7: NOT(G3) -> wire 12
            [uint24(11), uint24(12)], // G8: OR(G1, G3) -> wire 13
            [uint24(13), uint24(13)], // G9: NOT(G8) -> wire 14
            [uint24(10), uint24(10)], // G10: NOT(G5) -> wire 15
            [uint24(14), uint24(15)]  // G11: OR(G8, G5) -> wire 16 (Final Output!)
        ];

        for (uint256 g = 0; g < 12; g++) {
            uint256 offset = g * 7;
            nl[offset] = bytes1(0); // opcode 0 = NAND
            nl[offset + 1] = bytes1(uint8(gates[g][0] >> 16));
            nl[offset + 2] = bytes1(uint8(gates[g][0] >> 8));
            nl[offset + 3] = bytes1(uint8(gates[g][0]));
            nl[offset + 4] = bytes1(uint8(gates[g][1] >> 16));
            nl[offset + 5] = bytes1(uint8(gates[g][1] >> 8));
            nl[offset + 6] = bytes1(uint8(gates[g][1]));
        }
        return nl;
    }

    function _signReport(
        uint256 witnessKey,
        bytes32 agId,
        uint256 epochId,
        uint256 availabilityPpm,
        uint256 latencyMs,
        uint256 nonce
    ) internal view returns (WitnessReport memory) {
        address witness = vm.addr(witnessKey);
        ServiceAgreement memory ag = factory.getAgreement(agId);
        WitnessReport memory r = WitnessReport({
            agreementId: agId,
            epochId: epochId,
            chainId: block.chainid,
            witness: witness,
            measurementStart: ag.startTime + (epochId - 1) * ag.epochDuration,
            measurementEnd: ag.startTime + epochId * ag.epochDuration,
            observationCount: 120,
            availabilityPpm: availabilityPpm,
            p95LatencyMs: latencyMs,
            evidenceHash: keccak256("EVIDENCE_DATA"),
            reportNonce: nonce,
            deadline: block.timestamp + 300,
            signature: ""
        });

        bytes32 digest = witnessRegistry.hashWitnessReport(r);
        (uint8 v, bytes32 rSig, bytes32 sSig) = vm.sign(witnessKey, digest);
        r.signature = abi.encodePacked(rSig, sSig, v);
        return r;
    }

    function test_EndToEnd_SuccessfulSettlement() public {
        uint256 initialCustomerBal = usdc.balanceOf(customer);
        uint256 initialProviderBal = usdc.balanceOf(provider);
        uint256 initialTreasuryBal = usdc.balanceOf(treasuryWallet);

        // Vault has 1,000 USDC in escrow
        assertEq(vault.agreementEscrow(agreementId), DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(address(vault)), DEPOSIT_AMOUNT);

        // Epoch 1: 3 witnesses produce reports.
        // Witness 1 & Witness 2 report 99.8% availability (>= 99.5% SLA threshold).
        // Witness 3 reports 90.0% availability.
        // Quorum (2-of-3) is MET!
        WitnessReport[] memory reports = new WitnessReport[](3);
        reports[0] = _signReport(witness1Key, agreementId, 1, 998000, 150, 1);
        reports[1] = _signReport(witness2Key, agreementId, 1, 997000, 160, 2);
        reports[2] = _signReport(witness3Key, agreementId, 1, 900000, 400, 3);

        // Execute settlement via SettlementEngine
        (SettlementOutcome outcome, bool circuitResult) = engine.settleEpoch(agreementId, 1, reports);

        // Verifications:
        assertTrue(circuitResult, "Circuit should authorize payment for 2-of-3 quorum");
        assertEq(uint256(outcome), uint256(SettlementOutcome.PAYOUT_PROVIDER));
        assertTrue(engine.isEpochSettled(agreementId, 1));

        // Financial balances check:
        // Escrow decreases by 100 USDC (from 1,000 to 900)
        assertEq(vault.agreementEscrow(agreementId), DEPOSIT_AMOUNT - EPOCH_PRICE);

        // Protocol fee: 0.5% of 100 USDC = 0.5 USDC = 500,000 micro-USDC
        uint256 fee = (EPOCH_PRICE * 50) / 10000;
        uint256 providerPayout = EPOCH_PRICE - fee;

        assertEq(vault.claimableBalances(address(usdc), provider), providerPayout);
        assertEq(vault.claimableTreasury(address(usdc)), fee);

        // Invariant check: Vault balance == remaining escrow + provider claimable + treasury claimable
        assertEq(
            usdc.balanceOf(address(vault)),
            vault.agreementEscrow(agreementId) + providerPayout + fee
        );

        // Provider withdraws their earnings
        vm.prank(provider);
        vault.withdraw(address(usdc));
        assertEq(usdc.balanceOf(provider), initialProviderBal + providerPayout);

        // Treasury withdraws protocol fee from vault into Treasury contract
        vault.withdrawTreasury(address(usdc));
        assertEq(usdc.balanceOf(address(treasury)), fee);

        // Protocol owner withdraws from Treasury contract to treasuryWallet
        vm.prank(owner);
        treasury.withdraw(address(usdc), treasuryWallet, fee);
        assertEq(usdc.balanceOf(treasuryWallet), initialTreasuryBal + fee);
    }

    function test_EndToEnd_SlaFailure_RefundCustomer() public {
        uint256 initialCustomerBal = usdc.balanceOf(customer);

        // Epoch 1: 2 of 3 witnesses report uptime below SLA (e.g. 91% and 92%)
        WitnessReport[] memory reports = new WitnessReport[](3);
        reports[0] = _signReport(witness1Key, agreementId, 1, 910000, 150, 1);
        reports[1] = _signReport(witness2Key, agreementId, 1, 920000, 160, 2);
        reports[2] = _signReport(witness3Key, agreementId, 1, 998000, 140, 3);

        // Execute settlement
        (SettlementOutcome outcome, bool circuitResult) = engine.settleEpoch(agreementId, 1, reports);

        // Verifications:
        assertFalse(circuitResult, "Circuit should reject payment when SLA quorum fails");
        assertEq(uint256(outcome), uint256(SettlementOutcome.REFUND_CUSTOMER));

        // Customer receives full 100 USDC refund into claimable balance
        assertEq(vault.claimableBalances(address(usdc), customer), EPOCH_PRICE);
        assertEq(vault.claimableBalances(address(usdc), provider), 0);

        // Customer withdraws refund
        vm.prank(customer);
        vault.withdraw(address(usdc));
        assertEq(usdc.balanceOf(customer), initialCustomerBal + EPOCH_PRICE);
    }

    function test_RevertWhen_EpochAlreadySettled() public {
        WitnessReport[] memory reports = new WitnessReport[](3);
        reports[0] = _signReport(witness1Key, agreementId, 1, 998000, 150, 1);
        reports[1] = _signReport(witness2Key, agreementId, 1, 997000, 160, 2);
        reports[2] = _signReport(witness3Key, agreementId, 1, 996000, 140, 3);

        engine.settleEpoch(agreementId, 1, reports);

        // Second attempt on same epoch must revert
        vm.expectRevert(SettlementEngine.EpochAlreadySettled.selector);
        engine.settleEpoch(agreementId, 1, reports);
    }

    function test_RevertWhen_UnauthorizedWitness() public {
        uint256 rogueKey = 0x999;
        WitnessReport[] memory reports = new WitnessReport[](3);
        reports[0] = _signReport(rogueKey, agreementId, 1, 998000, 150, 1);
        reports[1] = _signReport(witness2Key, agreementId, 1, 997000, 160, 2);
        reports[2] = _signReport(witness3Key, agreementId, 1, 996000, 140, 3);

        vm.expectRevert();
        engine.settleEpoch(agreementId, 1, reports);
    }

    function test_RevertWhen_ReportExpired() public {
        WitnessReport[] memory reports = new WitnessReport[](3);
        reports[0] = _signReport(witness1Key, agreementId, 1, 998000, 150, 1);
        reports[1] = _signReport(witness2Key, agreementId, 1, 997000, 160, 2);
        reports[2] = _signReport(witness3Key, agreementId, 1, 996000, 140, 3);

        // Warp time past deadline
        vm.warp(block.timestamp + 500);

        vm.expectRevert(WitnessRegistry.ReportExpired.selector);
        engine.settleEpoch(agreementId, 1, reports);
    }

    function test_DisputeWorkflow() public {
        uint256 epochEnd = factory.getAgreement(agreementId).startTime + EPOCH_DURATION;
        vm.warp(epochEnd);
        // Customer raises dispute for epoch 1
        vm.prank(customer);
        disputeController.raiseDispute(
            agreementId,
            1,
            keccak256("EVIDENCE_OUTAGE_DURING_PEAK_HOURS"),
            epochEnd
        );

        assertTrue(disputeController.isDisputeActive(agreementId, 1));

        // Admin resolves dispute: upholds customer claim
        vm.prank(owner);
        disputeController.resolveDispute(agreementId, 1, true);

        assertEq(
            uint256(disputeController.getDisputeStatus(agreementId, 1)),
            uint256(DisputeController.DisputeStatus.UPHELD)
        );
        assertTrue(disputeController.isDisputeActive(agreementId, 1));
    }

    function testFuzz_FinancialInvariant_Accounting(
        uint256 epochPriceFuzz,
        uint8 numEpochsFuzz
    ) public {
        // Constrain fuzz parameters to realistic ranges
        // epochPrice: 1 USDC to 500 USDC
        uint256 epochPrice = bound(epochPriceFuzz, 1 * 1e6, 500 * 1e6);
        // numEpochs: 1 to 5
        uint256 numEpochs = bound(uint256(numEpochsFuzz), 1, 5);
        uint256 deposit = epochPrice * numEpochs;

        // Customer creates fuzzed agreement
        usdc.mint(customer, deposit);
        vm.startPrank(customer);
        usdc.approve(address(vault), deposit);
        bytes32 agId = factory.createAgreement(
            provider,
            address(usdc),
            deposit,
            epochPrice,
            EPOCH_DURATION,
            policyId
        );
        vm.stopPrank();

        vm.warp(block.timestamp + EPOCH_DURATION + disputeController.disputeWindow() + 1);

        uint256 vaultBalBefore = usdc.balanceOf(address(vault));

        // Settle epoch 1 with passing SLA
        WitnessReport[] memory reports = new WitnessReport[](3);
        reports[0] = _signReport(witness1Key, agId, 1, 998000, 150, 100);
        reports[1] = _signReport(witness2Key, agId, 1, 997000, 160, 101);
        reports[2] = _signReport(witness3Key, agId, 1, 996000, 140, 102);

        engine.settleEpoch(agId, 1, reports);

        // Calculate expected split
        uint256 fee = (epochPrice * 50) / 10000;
        uint256 payout = epochPrice - fee;

        // Financial Invariant 1: Escrow reduced by exactly epochPrice
        assertEq(vault.agreementEscrow(agId), deposit - epochPrice);

        // Financial Invariant 2: Total Vault USDC balance remains conserved
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore);

        // Financial Invariant 3: Payout + Fee == epochPrice
        assertEq(payout + fee, epochPrice);
    }

    function _reports(uint256 epochId) internal view returns (WitnessReport[] memory reports) {
        reports = new WitnessReport[](3);
        // Equal nonces across distinct signing identities must be accepted.
        reports[0] = _signReport(witness1Key, agreementId, epochId, 998000, 150, epochId);
        reports[1] = _signReport(witness2Key, agreementId, epochId, 997000, 160, epochId);
        reports[2] = _signReport(witness3Key, agreementId, epochId, 996000, 140, epochId);
    }

    function test_RevertWhen_AnyoneConsumesWitnessReports() public {
        WitnessReport[] memory reports = _reports(1);
        vm.expectRevert(WitnessRegistry.UnauthorizedCaller.selector);
        witnessRegistry.validateWitnessReports(agreementId, 1, reports);
        engine.settleEpoch(agreementId, 1, reports);
    }

    function test_NoncesArePerWitnessAndAccountingAdvances() public {
        engine.settleEpoch(agreementId, 1, _reports(1));
        ServiceAgreement memory ag = factory.getAgreement(agreementId);
        assertEq(ag.currentEpoch, 2);
        assertEq(ag.spentAmount, EPOCH_PRICE);
        assertEq(ag.refundedAmount, 0);
        assertEq(witnessRegistry.lastReportNonce(agreementId, witness1), 1);
        assertEq(witnessRegistry.lastReportNonce(agreementId, witness2), 1);
    }

    function test_RevertWhen_FutureEpochOrUnfinishedWindow() public {
        WitnessReport[] memory reports = _reports(2);
        vm.expectRevert(SettlementEngine.InvalidEpoch.selector);
        engine.settleEpoch(agreementId, 2, reports);
        reports = _reports(1);
        vm.warp(factory.getAgreement(agreementId).startTime + EPOCH_DURATION);
        vm.expectRevert(SettlementEngine.InvalidEpoch.selector);
        engine.settleEpoch(agreementId, 1, reports);
    }

    function test_RevertWhen_IncompleteReports() public {
        WitnessReport[] memory reports = new WitnessReport[](2);
        reports[0] = _signReport(witness1Key, agreementId, 1, 998000, 150, 1);
        reports[1] = _signReport(witness2Key, agreementId, 1, 997000, 160, 1);
        vm.expectRevert(SettlementEngine.InvalidReports.selector);
        engine.settleEpoch(agreementId, 1, reports);
    }

    function test_RevertWhen_DisputeRaisedByOutsiderOrSpoofedWindow() public {
        uint256 epochEnd = factory.getAgreement(agreementId).startTime + EPOCH_DURATION;
        vm.warp(epochEnd);
        vm.expectRevert(DisputeController.InvalidDispute.selector);
        disputeController.raiseDispute(agreementId, 1, keccak256("outage"), epochEnd);
        vm.prank(customer);
        vm.expectRevert(DisputeController.InvalidDispute.selector);
        disputeController.raiseDispute(agreementId, 1, keccak256("outage"), epochEnd + 1000);
    }

    function test_RevertWhen_ActiveDisputeForAvailabilityPolicy() public {
        uint256 epochEnd = factory.getAgreement(agreementId).startTime + EPOCH_DURATION;
        vm.warp(epochEnd);
        vm.prank(customer);
        disputeController.raiseDispute(agreementId, 1, keccak256("outage"), epochEnd);
        vm.warp(epochEnd + disputeController.disputeWindow() + 1);
        WitnessReport[] memory reports = _reports(1);
        vm.expectRevert(SettlementEngine.DisputeActive.selector);
        engine.settleEpoch(agreementId, 1, reports);
    }

    function test_RevertWhen_PolicyNetlistHashMismatch() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(CircuitPolicyRegistry.InvalidCircuit.selector, circuitId));
        policyRegistry.registerPolicy(keccak256("incorrect hash"), circuitId, SLA_UPTIME_PPM, SLA_LATENCY_MS, bytes32(0));
    }

    function test_RevertWhen_PolicyDeactivated() public {
        vm.prank(owner);
        policyRegistry.setPolicyStatus(policyId, false);
        WitnessReport[] memory reports = _reports(1);
        vm.expectRevert(SettlementEngine.PolicyInactive.selector);
        engine.settleEpoch(agreementId, 1, reports);
    }

    function test_RevertWhen_OwnerAllocatesEscrowDirectly() public {
        vm.prank(owner);
        vm.expectRevert(SettlementVault.UnauthorizedCaller.selector);
        vault.allocateRefund(agreementId, owner, EPOCH_PRICE);
    }

    function test_SixInputPolicyUsesLatencyBitForEachWitness() public {
        // A small diagnostic policy returns input bit 1 (witness 1 latency).
        // It distinguishes latency packing from the old availability-only fallback.
        bytes memory netlist = hex"0000000300000300000008000008";
        vm.startPrank(owner);
        uint256 diagnosticCircuit = tapeout.tapeout{value: 0.0013 ether}(netlist, 6, 1);
        bytes32 strictPolicy = keccak256("LATENCY_PACKING_DIAGNOSTIC");
        policyRegistry.registerPolicy(strictPolicy, diagnosticCircuit, SLA_UPTIME_PPM, SLA_LATENCY_MS, keccak256(netlist));
        vm.stopPrank();
        vm.prank(customer);
        bytes32 strictAgreement = factory.createAgreement(provider, address(usdc), EPOCH_PRICE, EPOCH_PRICE, EPOCH_DURATION, strictPolicy);
        vm.warp(block.timestamp + EPOCH_DURATION + disputeController.disputeWindow() + 1);
        WitnessReport[] memory reports = new WitnessReport[](3);
        reports[0] = _signReport(witness1Key, strictAgreement, 1, 998000, 400, 1);
        reports[1] = _signReport(witness2Key, strictAgreement, 1, 998000, 150, 1);
        reports[2] = _signReport(witness3Key, strictAgreement, 1, 998000, 150, 1);
        (SettlementOutcome outcome, bool result) = engine.settleEpoch(strictAgreement, 1, reports);
        assertFalse(result);
        assertEq(uint256(outcome), uint256(SettlementOutcome.REFUND_CUSTOMER));
        assertEq(vault.claimableBalances(address(usdc), customer), EPOCH_PRICE);
    }
}
