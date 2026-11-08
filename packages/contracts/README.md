# LATCHWORK contracts

Solidity 0.8.24 / Foundry contracts for ERC-20 escrow, signed witness evidence, TapeOut policy evaluation, payout allocation and pull withdrawals. These are unaudited prototype contracts. No LATCHWORK deployment or transaction on X Layer is claimed by this repository.

```sh
# From the repository root
git submodule update --init --recursive
cd packages/contracts
forge build
forge test -vvv --fuzz-runs 256
node scripts/export-abi.js
pnpm build
```

Settlement tests use MockTapeOutProcessor and MockUSDC. Separately, adapter tests make read-only calls to existing circuit 1 on X Layer; those calls do not demonstrate deployment of a LATCHWORK policy or execution of a LATCHWORK payment transaction.

## Contract wiring

script/Deploy.s.sol:DeployLatchwork deploys and connects seven protocol contracts. It configures the vault factory/engine, witness registry engine, factory engine and dispute controller factory/engine. Run against Anvil locally; --broadcast sends transactions.

```sh
anvil
# In another terminal, from packages/contracts:
forge script script/Deploy.s.sol:DeployLatchwork --rpc-url http://127.0.0.1:8545 --broadcast
```

Only chain 31337 can use the script's known local development key and default witness addresses. Other chains require an explicit DEPLOYER_PRIVATE_KEY and three distinct WITNESS_1_ADDRESS, WITNESS_2_ADDRESS, WITNESS_3_ADDRESS values. Never commit private keys. On X Layer chain 196, the script uses the configured live TapeOut processor. It does not deploy/register a settlement circuit or configure a production payment token.

Customers approve the vault before createAgreement. Escrow requires the token balance to increase by the exact requested amount; fee-on-transfer tokens are rejected.

## Settlement rules

- Agreements use sequential epochs of at least 60 seconds. currentEpoch, spentAmount and refundedAmount advance only through the configured engine.
- Settlement requires all three distinct authorized witness reports with exact agreement epoch measurement bounds. Reports require EIP-712 signatures, positive observation counts, availability at most 1,000,000 ppm, unexpired deadlines and increasing nonces per agreement and signer. The default signature quorum remains two; three reports prevent selective omission from altering the circuit majority.
- The epoch and challenge window must finish before settlement. Only an agreement participant can dispute, using the contract-derived epoch end time.
- Policies require one output, zero state, 3/5/6 supported inputs, a matching on-chain netlist hash and an active registry entry. Three inputs mean witness availability; five mean each witness's combined availability/latency, authorization and dispute; six alternate availability/latency per witness.
- Open or upheld disputes prevent allocation for every template. Dismissal permits normal circuit settlement.
- Only the factory deposits escrow, and only the engine allocates payouts/refunds. Recipients withdraw their own claimable balances.

## Remaining limitations

Witness operators, policy publishers and administrators are trusted. Administrators can replace contract roles and modify quorum, witness authorization, policy status, fees and challenge duration. The factory does not pin policy truth tables. Identity signatures do not prove independent or accurate observations.

Cancellation, unused escrow withdrawal, missing-witness recovery, upheld-dispute refunds, immutable governance and comprehensive stateful invariant testing remain incomplete. Upheld disputes currently hold funds indefinitely. Do not deposit meaningful funds. The gateway/database are not joined to a verified event indexer and production settlement relayer.
