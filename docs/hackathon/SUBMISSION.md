# LATCHWORK - hackathon submission draft

Status: source and public frontend prepared; on-chain product deployment and full submission evidence remain incomplete.

- Product: LATCHWORK
- Tagline: Services prove performance. Circuits enforce payment.
- Source: https://github.com/eshaanvgupta/latchwork
- Web preview: https://eshaanvgupta.github.io/latchwork/
- Network used by read-only integration: X Layer mainnet (196)
- TapeOut processor: `0x839bdD6fa7A66416A609A735e11DE5411B98574e`
- Existing ecosystem circuit checked: circuit 1 (XOR); not a LATCHWORK SLA deployment
- LATCHWORK deployment addresses / transaction hashes: not yet available
- Demo video: not recorded

## Product and customers

API providers and AI-agent builders need a way to agree on service performance before payment. LATCHWORK explores compiling a service-level agreement into TapeOut NAND logic, evaluating signed observations and allocating prepaid escrow according to the result. Customers would pay for transparent usage records and automated compensation; providers would pay for predictable settlement and lower billing support costs.

Initial distribution would target API startups, agent SDK communities and X Layer infrastructure providers through an open-source gateway, integration examples and pilot service agreements. The proposed business model combines a configurable settlement fee (the example contract defaults to 0.5%) with hosted gateway and monitoring subscriptions. These are proposed revenue streams, not operating revenue or implemented subscription billing.

## Implemented work

The repository includes the policy compiler/simulator, a wallet-aware frontend, service and agreement APIs, a credential-bound gateway, signed witness-report tooling and Solidity escrow/settlement contracts. The current witnesses are three identities controlled by one operator. Database storage is SQLite. The public preview supports local circuit experiments; it has no hosted financial backend.

Live adapter tests confirm the existing TapeOut XOR circuit's metadata and truth table, and compare it with local compilation. Solidity settlement checks currently use a mock TapeOut processor. This distinction must remain explicit in the final submission and video.

## Work needed before submitting as a complete product

1. Publish the intended stateless SLA circuit on X Layer, record its processor and circuit ID, and verify every input combination against the local compiler.
2. Deploy and verify the LATCHWORK contracts using privately controlled signer/witness identities and an explicitly verified supported payment token.
3. Connect the UI, API, gateway, reports and indexer to those contracts. Capture actual deposit, request, report, circuit evaluation, allocation and withdrawal transaction evidence.
4. Address locked-fund exit and dispute resolution limitations identified in the engineering review; perform an independent security review before meaningful funds.
5. Host the backend services with durable storage and HTTPS, record a video under three minutes and submit the official form.
6. Identify precisely which changes were completed during the event. This review/publishing work is dated November 8, 2026; do not infer earlier development dates from a snapshot commit.

The [official event page](https://web3.okx.com/xlayer/build-x-series) governs eligibility, the form and the provisional December 7, 2026 23:59 UTC deadline. Repository publication alone does not establish acceptance or complete the form submission.
