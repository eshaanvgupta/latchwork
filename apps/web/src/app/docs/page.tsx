'use client';

import Link from 'next/link';
import { BookOpen, ExternalLink } from 'lucide-react';

const compile = `import {
  buildEnterpriseSlaTemplate,
  simulateCircuit,
  generateTruthTable,
} from '@latchwork/circuit-compiler';

const circuit = buildEnterpriseSlaTemplate();
// w1, w2, w3, agreement_auth, dispute_active
const { outputs } = simulateCircuit(circuit,
  [true, true, false, true, false]);
console.log(outputs[0]); // true
console.log(circuit.netlistHex);
console.log(generateTruthTable(circuit));`;
const inspect = `import { TapeOutClient } from '@latchwork/tapeout-adapter';

const tapeout = new TapeOutClient('https://rpc.xlayer.tech');
// Supply an existing, verified circuit ID.
const info = await tapeout.getCircuitInfo(circuitId);
const netlist = await tapeout.getNetlist(circuitId);
const result = await tapeout.evalOnChain(circuitId, inputs);
// eth_call only; does not deploy or move funds.`;
const gateway = `curl 'http://localhost:4001/v1/service/YOUR_SERVICE/api/data' \\
  -H 'X-Latchwork-Key: YOUR_GATEWAY_KEY'

# Receipt ID and signature are response headers.
# Retrieve the stored receipt using the same agreement key:
curl 'http://localhost:4001/v1/receipts/RECEIPT_ID' \\
  -H 'X-Latchwork-Key: YOUR_GATEWAY_KEY'`;

export default function DocsPage() {
  return <div className="narrow-shell space-y-8">
    <div className="page-heading"><div className="flex gap-2 items-center text-xs font-mono text-amber-400 mb-2"><BookOpen className="h-4 w-4" /> DEVELOPER REFERENCE</div><h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Build with LATCHWORK</h1><p className="mt-3 text-sm text-zinc-400">These packages currently live in this monorepo. They are not published npm packages.</p></div>
    <section className="rounded-xl border border-white/10 bg-surface p-5"><h2 className="font-semibold text-lg">Current implementation</h2><p className="text-sm text-zinc-400 mt-3 leading-relaxed">The repository contains a Boolean-to-NAND compiler, read-only TapeOut adapter, Solidity settlement contracts, wallet-signature authentication, a persistent development database, gateway receipts, and operator-controlled witness identities. Public GitHub Pages hosts this frontend. Backend services and LATCHWORK contracts require separate deployment. This UI does not transact with escrow contracts.</p>
      <a href="https://github.com/eshaanvgupta/latchwork" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-amber-400 text-sm mt-4">Repository, setup and readiness report <ExternalLink className="h-3 w-3" /></a></section>
    {[[ 'Compile and simulate locally', compile ], ['Inspect TapeOut on X Layer', inspect], ['Send gateway traffic', gateway]].map(([title, code]) => <section key={title} className="rounded-xl border border-white/10 bg-surface p-5"><h2 className="font-semibold mb-4">{title}</h2><pre className="overflow-x-auto rounded-lg bg-black/30 p-4 text-xs font-mono text-zinc-300 leading-relaxed">{code}</pre></section>)}
    <section className="rounded-xl border border-white/10 bg-surface p-5 space-y-3"><h2 className="font-semibold">Authentication and provider onboarding</h2><ol className="list-decimal list-inside text-sm text-zinc-400 space-y-2"><li>Connect an injected Ethereum-compatible wallet.</li><li>The backend returns a nonce and message from POST /auth/nonce.</li><li>Sign the exact message and send it to POST /auth/verify for a bearer token.</li><li>Create an organization, service and plan through the authenticated API.</li><li>Host the challenge token at /.well-known/latchwork-challenge and request verification.</li></ol><Link href="/services/create" className="inline-block text-amber-400 text-sm">Open provider registration →</Link></section>
    <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5"><h2 className="font-semibold text-amber-200">Trust and deployment limits</h2><p className="mt-3 text-sm text-zinc-400">Three witness identities run under one operator. Gateway receipts are signed usage records, not proof of settlement. Read-only circuit evaluation is not a deployment transaction. Database agreement amounts are unverified sandbox records. A production database, event indexer, deployed contract addresses, economic security review, and complete wallet transaction flows remain required before handling customer funds.</p></section>
  </div>;
}
