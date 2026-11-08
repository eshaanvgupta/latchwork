// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/MockTapeOutProcessor.sol";
import "../src/ProtocolTreasury.sol";
import "../src/WitnessRegistry.sol";
import "../src/CircuitPolicyRegistry.sol";
import "../src/DisputeController.sol";
import "../src/SettlementVault.sol";
import "../src/AgreementFactory.sol";
import "../src/SettlementEngine.sol";

contract DeployLatchwork is Script {
    address public constant XLAYER_CPU0 = 0x839bdD6fa7A66416A609A735e11DE5411B98574e;

    function run() external {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        if (block.chainid != 31337) {
            // Never deploy a live protocol with the publicly known Anvil key.
            deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
            require(deployerPrivateKey != 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80, "unsafe deployment key");
        }
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        address tapeoutCpu;
        MockUSDC usdc;

        if (block.chainid == 196) {
            tapeoutCpu = XLAYER_CPU0;
        } else {
            MockTapeOutProcessor mockCpu = new MockTapeOutProcessor();
            tapeoutCpu = address(mockCpu);
            usdc = new MockUSDC();
            usdc.mint(deployer, 1000000 * 1e6);
        }

        ProtocolTreasury treasury = new ProtocolTreasury(deployer, deployer);
        WitnessRegistry witnessRegistry = new WitnessRegistry(deployer);
        CircuitPolicyRegistry policyRegistry = new CircuitPolicyRegistry(deployer, tapeoutCpu);
        DisputeController disputeController = new DisputeController(deployer);
        SettlementVault vault = new SettlementVault(deployer, address(treasury));
        AgreementFactory factory = new AgreementFactory(deployer, address(vault), address(policyRegistry));
        SettlementEngine engine = new SettlementEngine(
            deployer,
            tapeoutCpu,
            address(vault),
            address(witnessRegistry),
            address(policyRegistry),
            address(disputeController),
            address(treasury),
            address(factory)
        );

        vault.setSettlementEngine(address(engine));
        vault.setAgreementFactory(address(factory));
        witnessRegistry.setSettlementEngine(address(engine));
        factory.setSettlementEngine(address(engine));
        disputeController.configure(address(factory), address(engine));

        // Authorize 3 default witness identities
        address witness1 = vm.envOr("WITNESS_1_ADDRESS", address(0x25A71a07cecf1753ee65b00E0a3AAEf7e0F51c0F));
        address witness2 = vm.envOr("WITNESS_2_ADDRESS", address(0x85E4E16Bd367E4259537269633DA9a6Aa4cf95a3));
        address witness3 = vm.envOr("WITNESS_3_ADDRESS", address(0xe6eF3a317f91A0a44eB097c8e68B49CcF9E63895));
        if (block.chainid != 31337) {
            witness1 = vm.envAddress("WITNESS_1_ADDRESS");
            witness2 = vm.envAddress("WITNESS_2_ADDRESS");
            witness3 = vm.envAddress("WITNESS_3_ADDRESS");
        }
        require(witness1 != witness2 && witness1 != witness3 && witness2 != witness3, "distinct witnesses required");

        witnessRegistry.authorizeWitness(witness1);
        witnessRegistry.authorizeWitness(witness2);
        witnessRegistry.authorizeWitness(witness3);

        vm.stopBroadcast();

        console.log("=== LATCHWORK PROTOCOL DEPLOYED ===");
        console.log("TapeOut Processor:", tapeoutCpu);
        console.log("Protocol Treasury:", address(treasury));
        console.log("Witness Registry:", address(witnessRegistry));
        console.log("Circuit Policy Registry:", address(policyRegistry));
        console.log("Dispute Controller:", address(disputeController));
        console.log("Settlement Vault:", address(vault));
        console.log("Agreement Factory:", address(factory));
        console.log("Settlement Engine:", address(engine));
        if (address(usdc) != address(0)) {
            console.log("Mock USDC:", address(usdc));
        }
    }
}
