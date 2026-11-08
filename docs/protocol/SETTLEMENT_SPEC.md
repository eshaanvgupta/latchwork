# Settlement implementation notes

The Solidity sources are authoritative. This document describes the prototype and its limitations; it does not assert a verified deployment.

## Accounting

The vault holds an ERC-20 token in integer base units. For tested operations, its balance must cover escrow liabilities plus withdrawable balances. Successful settlement splits an epoch amount into provider proceeds and a basis-point treasury fee; the example fee is 50/10,000. Failed policy evaluation allocates a customer refund. Allocation and withdrawal are separate operations.

Local fuzz tests exercise accounting properties. They do not prove all multi-user state transitions or production safety. Cancellation/unused-escrow exits and complete dispute-refund resolution remain gaps.

## Reports

Use the exact `WitnessEpochReport` structure in `packages/contracts/src/interfaces/ILatchworkTypes.sol` and the EIP-712 definitions in `packages/shared/src/crypto.ts`. A report includes agreement and epoch IDs, chain, signer, measurement window, observation count, availability, latency, evidence hash, nonce and deadline. Do not substitute a differently named report type or domain when signing.

The witness registry permits nonce consumption only through its configured engine. Settlement enforces agreement timing, signature quorum, signer distinctness, report domains and report windows. Separate witness keys do not establish operator independence.

## Policy execution

Registered settlement policies must use a supported stateless input shape. The engine packs the verified SLA predicates, calls `evalCircuit` on the configured processor and uses output bit zero to choose an allocation. A read-only test against existing TapeOut XOR circuit 1 validates adapter packing; the local settlement tests use a mock processor. A deployed SLA circuit and real full-flow transactions remain necessary to verify the intended integration.
