# Engineering review - November 8, 2026

## Verdict

LATCHWORK is a substantial hackathon prototype, not the complete production product described in the original build directive. Publication includes a working static frontend and source for local services and contracts. A deployed, transaction-backed financial lifecycle has not been demonstrated.

The original README, video script and UI overstated verification and sometimes generated fake success data. Those behaviors and claims were removed. The public preview makes its backend and financial limitations visible.

## Verified behavior

| Area | Evidence |
| --- | --- |
| Solidity | 17 Foundry tests pass, including one financial property fuzzed with 256 cases. Uses MockTapeOutProcessor and MockUSDC. |
| Shared types/signatures | 2 tests pass. |
| NAND compiler | 8 tests pass, including selected outputs, browser-compatible encoding and invalid gate handling. |
| TapeOut adapter | 5 tests pass: 3 read-only live X Layer checks and 2 output/dimension regressions. |
| SDK | 3 tests pass. |
| API | 10 tests pass, including challenge replay, challenge-message substitution and ownership authorization checks. |
| Gateway | 15 tests pass, including real HTTP forwarding, stored credentials, tenant isolation, durable receipts, quota rejection and SSRF checks. |
| Monitor | 5 tests pass, including signed report verification and rejection of unmeasured report requests. |
| Local HTTP integration | 8 checks pass: login, service verification, gateway request, signed receipt, access rejection, measured witness reports and separate-process durability. Four upstream HTTP requests, one receipt, three reports, zero blockchain transactions. |
| Web build | Normal production build and Pages static export pass, with 11 generated pages including framework output. |
| Browser | Desktop and mobile checks pass: input toggles change compiler output, 32 truth-table rows, JSON export, base-path navigation, offline/backend and missing-wallet guards, no mobile overflow, zero JavaScript errors and no backend requests from the static preview. |
| Database bootstrap | Fresh SQLite file initialization, schema push and seed pass after adding file preparation. |
| Dependencies | `pnpm audit --prod` reports zero known advisories for the reviewed lockfile. This result is time-dependent. |

One initial consolidated test attempt failed because a fresh SQLite database had not been initialized. It exposed a first-run schema-engine failure. Database setup now prepares the file before schema push; tests were rerun after initialization. No failed check is counted as a pass.

## Live TapeOut read evidence

Read-only verification observed X Layer chain ID 196, block 75390435:

- Processor: `0x839bdD6fa7A66416A609A735e11DE5411B98574e`
- Processor bytecode hash: `0x57aa306fd0be97087da3534e03398f5ff4efd533b5be4e45a405ce86fa6717d5`
- Existing circuit ID: 1, stateless XOR, two inputs, one output, four NAND gates.
- All four input combinations match the local compiler.
- Circuit netlist hash: `0x564b93679937b8cbafd5ae8fd11f7caf200606f267f1cdb37a38f95e361b2a0f`

These are `eth_call` reads, not LATCHWORK deployment/settlement transactions. The existing XOR circuit must not be represented as an original LATCHWORK circuit.

## Defects addressed

- Removed fabricated wallet accounts, circuit deployment addresses, settlement transactions, receipt signatures and success fallbacks.
- Bound login to the exact issued challenge and atomically consumed nonces.
- Required production secrets and private gateway/witness identities; restricted monitor actions with an operator token in production.
- Required stored active gateway keys and derived agreement/service/epoch authorization server-side.
- Added DNS validation and pinning, origin preservation and response/time limits for upstream requests.
- Restricted witness nonce consumption to the configured engine and tracked nonces per signer.
- Added settlement epoch timing, sequential processing, report-window checks and participant-authorized disputes.
- Rejected unsupported stateful settlement policies, corrected input/output packing and compared all circuit outputs during equivalence checks.
- Separated vault permissions and rejected ERC-20 deposits that credit a different amount.
- Fixed missing submodule configuration, database/bootstrap/container build wiring, environment examples, ports and publication exclusions.
- Updated vulnerable dependencies and pinned patched transitive dependencies in the workspace configuration.

## Unfinished requirements from the directive

| Requirement | Remaining work |
| --- | --- |
| End-to-end funds flow on X Layer | Deploy contracts and compatible SLA circuit; verify token, deposit, allocation and withdrawal transactions. |
| Contract lifecycle completeness | Add cancellation/unused escrow exits, missing-witness recovery and execution of upheld-dispute refunds. Current disputes can lock funds indefinitely. |
| Witness epoch collection | Add a durable scheduler and aggregation spanning exact contract epoch boundaries. Current process-local sample windows generally do not satisfy settlement windows. |
| Durable chain synchronization | Implement deposit verification, event indexing with restart/reorg handling, idempotent orchestration and relaying. Production API agreement activation fails closed without this. |
| Production infrastructure | Host API/gateway/monitor with HTTPS, persistent secrets, backups and access controls. Docker configuration was reviewed but not executed because Docker was unavailable. |
| Database and queues | Implement the requested PostgreSQL deployment and migrations if retained as a product requirement. Current schema is SQLite; Redis/distributed queues are absent. |
| Gateway concurrency | Make quota reservation atomic across concurrent requests and replicas. Current count-then-forward quota check can overshoot under concurrency; limiter state is local. |
| Financial ledger and billing | Replace off-chain floating-point financial fields, add authoritative chain reconciliation, entitlements and subscription billing. |
| Full product interfaces | Complete deposits, refunds, withdrawals, organization settings, notifications and the verified customer/provider journey. Preview pages cannot operate a hosted backend. |
| Security assurance | Independently review trusted administration, circuit policy semantics and token support; broaden adversarial state-machine/invariant testing. |
| Submission package | Record a real demo, identify event-period additions, attach actual LATCHWORK addresses/evidence and submit the official form. |

Three different signing keys under one operator do not provide independent witnesses. Signed observations establish who signed a statement, not that the service behaved correctly. Review these assumptions before making commercial or security guarantees.

## Publication scope

The public GitHub repository contains a reviewed source snapshot, workflows and documentation. Local environment files, databases and prior local history are excluded from publication. GitHub Pages hosts only the static frontend and local Policy Studio. Source publication and frontend deployment do not complete hackathon registration or establish eligibility.
