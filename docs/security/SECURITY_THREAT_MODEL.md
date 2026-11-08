# Security and trust assumptions

This repository has been reviewed and patched for concrete defects. It has not been independently audited and is not ready to custody meaningful funds.

## Implemented boundaries

- API login requires the server-issued wallet challenge and consumes the nonce once. Production requires a configured JWT secret.
- Gateway access requires a matching active stored credential, service and agreement. Customer-supplied agreement/epoch headers do not grant access. URL validation and DNS pinning reduce SSRF exposure. The local-upstream exception is for development only.
- Witness report verification is restricted to the configured settlement engine, uses per-witness replay protection and rejects duplicate signers and invalid measurement windows.
- Settlement checks sequential epochs, elapsed time and active disputes. Policy registration rejects unsupported stateful circuit layouts.
- Vault withdrawals follow checks/effects/interactions and separate financial roles. The token transfer path rejects a deposit that credits a different amount.

## Remaining risks

| Area | Limitation |
| --- | --- |
| Custody and exits | Cancellation/unused-escrow exits and upheld-dispute refund completion are incomplete; funds can remain locked. |
| Administration | Owners can change trusted engines and witnesses. No production timelock/governance guarantees are claimed. |
| Witnesses | One operator controls all three identities. Development keys in source are public test keys; generate private replacements before deployment. |
| Evidence | Probes and gateway receipts are observations, not proof of API semantic correctness. Monitor observations and rate-limit state are not distributed durable state. |
| Financial records | Off-chain models use floating-point USDC fields and are not an authoritative chain accounting ledger. On-chain values use integer token units. |
| Chain integration | No verified deployed LATCHWORK address, registered SLA circuit, transaction-backed indexer or complete UI financial flow is available. |
| Service exposure | Keep local sandbox services private. Production needs restricted origins, HTTPS, operator authentication, traffic controls, persistent secrets and a reviewed upstream ownership workflow. |
| Dependencies | Dependency updates are tested locally; audit output is time-dependent. Re-run `pnpm audit --prod` before every public backend deployment. |

The gateway signs its own receipts using message signatures; witness reports use EIP-712. Do not claim that providers sign gateway receipts or that all receipt signatures use EIP-712.

## Publication hygiene

Environment files and local databases are excluded. The public repository starts from a reviewed source snapshot, so previous local database contents and build history are not published. Existing local commits remain available in the original workspace. No private deployment key is required for the Pages preview or read-only tests.
