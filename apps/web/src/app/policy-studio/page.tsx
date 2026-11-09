'use client';

import { useMemo, useState } from 'react';
import { Cpu, Download, CheckCircle2, XCircle, Play, RefreshCw } from 'lucide-react';
import { buildAvailabilityTemplate, buildAvailabilityAndLatencyTemplate, buildEnterpriseSlaTemplate,
  simulateCircuit, generateTruthTable } from '@latchwork/circuit-compiler';
import { TapeOutClient } from '@latchwork/tapeout-adapter';

const templates = [
  { name: 'Availability Quorum', description: 'Two of three witness availability checks must pass.', build: buildAvailabilityTemplate },
  { name: 'Availability + Latency', description: 'Two witnesses must each pass both SLA checks.', build: buildAvailabilityAndLatencyTemplate },
  { name: 'Enterprise Policy', description: 'Witness majority, agreement authorization, and no active dispute.', build: buildEnterpriseSlaTemplate },
];

export default function PolicyStudioPage() {
  const [selected, setSelected] = useState(2);
  const [values, setValues] = useState<Record<string, boolean>>({ w1_verified: true, w2_verified: true, agreement_auth: true });
  const [circuitId, setCircuitId] = useState('');
  const [checking, setChecking] = useState(false);
  const [chainResult, setChainResult] = useState('');
  const circuit = useMemo(() => templates[selected].build(), [selected]);
  const inputs = circuit.inputNames.map(name => !!values[name]);
  const output = simulateCircuit(circuit, inputs).outputs[0];
  const table = useMemo(() => generateTruthTable(circuit), [circuit]);

  const download = () => {
    const blob = new Blob([JSON.stringify({ ...circuit, truthTable: table }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'latchwork-policy.json'; anchor.click();
    URL.revokeObjectURL(url);
  };

  const verify = async () => {
    setChecking(true); setChainResult('');
    try {
      if (!/^\d+$/.test(circuitId)) throw new Error('Enter a published TapeOut circuit ID.');
      const client = new TapeOutClient(process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.xlayer.tech');
      const netlist = await client.getNetlist(BigInt(circuitId));
      const info = await client.getCircuitInfo(BigInt(circuitId));
      if (netlist.toLowerCase() !== circuit.netlistHex.toLowerCase() || info.numInputs !== circuit.numInputs || info.numOutputs !== circuit.numOutputs || info.numState !== 0) {
        throw new Error('The published circuit does not match this compiled policy. Publish the exported netlist first.');
      }
      const result = await client.evalOnChain(BigInt(circuitId), inputs, circuit.numOutputs);
      setChainResult(`X Layer eth_call result: ${Number(result[0])}. ${result[0] === output ? 'Matches local NAND simulation.' : 'MISMATCH: do not use this circuit.'} No transaction was sent.`);
    } catch (error) { setChainResult(error instanceof Error ? error.message : 'RPC verification failed.'); }
    finally { setChecking(false); }
  };

  return <div className="page-shell space-y-8">
    <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
      <div className="page-heading"><div className="flex gap-2 items-center text-xs font-mono text-amber-400 mb-2"><Cpu className="h-4 w-4" /> TAPEOUT POLICY STUDIO</div>
        <h1 className="text-3xl font-display font-bold leading-tight sm:text-4xl">Compile. Inspect. Simulate.</h1>
        <p className="mt-2 text-sm text-zinc-400">The actual TypeScript compiler produces the netlist and evaluates every NAND gate in your browser.</p></div>
      <button onClick={download} className="flex shrink-0 gap-2 items-center rounded-xl bg-amber-400 text-black px-4 py-3 text-sm font-semibold"><Download className="h-4 w-4" /> Export netlist + truth table</button>
    </div>
    <div className="grid md:grid-cols-3 gap-4">{templates.map((template, index) => <button key={template.name}
      onClick={() => { setSelected(index); setValues({}); setChainResult(''); }}
      className={`min-h-32 text-left rounded-xl border p-5 ${selected === index ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10 bg-white/[0.02]'}`}>
      <h2 className="font-semibold">{template.name}</h2><p className="text-sm text-zinc-400 mt-2">{template.description}</p>
    </button>)}</div>
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="content-panel p-5 space-y-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Simulation inputs</h2>
        <p className="text-xs text-zinc-400">These Boolean checks represent measurements verified by witnesses. The compiler does not measure uptime or validate signatures.</p>
        {circuit.inputNames.map(name => <label key={name} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-3">
          <span className="font-mono text-xs text-zinc-300">{name}</span>
          <input type="checkbox" className="h-5 w-5 accent-amber-400" checked={!!values[name]} onChange={event => { setValues({ ...values, [name]: event.target.checked }); setChainResult(''); }} />
        </label>)}
        <div className={`flex items-center gap-3 rounded-xl p-4 border ${output ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
          {output ? <CheckCircle2 /> : <XCircle />}<div><strong>Local output: {Number(output)}</strong><p className="text-xs mt-1">{output ? 'Policy would authorize provider allocation.' : 'Policy would reject provider allocation.'} No funds moved.</p></div>
        </div>
      </section>
      <section className="content-panel p-5 space-y-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Compiled circuit</h2>
        <div className="grid grid-cols-3 gap-3 text-center">{[[circuit.numInputs, 'Inputs'], [circuit.numGates, 'NAND gates'], [circuit.numOutputs, 'Output']].map(([value, label]) => <div className="rounded-lg bg-white/5 py-3" key={label}><strong className="text-2xl text-amber-400">{value}</strong><p className="text-xs text-zinc-500">{label}</p></div>)}</div>
        <p className="text-xs text-zinc-500">7 bytes per gate: opcode, uint24 input A, uint24 input B. Stateless, least significant bit first.</p>
        <pre className="rounded-lg bg-black/30 p-4 text-xs text-zinc-300 whitespace-pre-wrap break-all max-h-44 overflow-y-auto">{circuit.netlistHex}</pre>
        <h3 className="text-sm font-semibold pt-2">Verify a published circuit on X Layer</h3>
        <p className="text-xs text-zinc-400">Read only. A matching circuit must already exist on CPU 0. Exporting a policy does not deploy it.</p>
        <div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Published TapeOut circuit ID" placeholder="Circuit ID" value={circuitId} onChange={event => setCircuitId(event.target.value)} className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm" />
          <button disabled={checking} onClick={verify} className="rounded-lg px-4 bg-indigo-500/20 text-indigo-200 flex items-center gap-2 text-sm disabled:opacity-50">{checking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Verify</button></div>
        {chainResult && <p role="status" className="text-xs text-amber-200 break-words">{chainResult}</p>}
      </section>
    </div>
    <section className="content-panel p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold mb-3">Exhaustive truth table ({table.length} input combinations)</h2>
      <div className="max-h-80 overflow-auto"><table className="w-full text-xs font-mono text-left"><thead className="text-zinc-400"><tr>{circuit.inputNames.map(name => <th className="p-2" key={name}>{name}</th>)}<th className="p-2">authorized</th></tr></thead>
        <tbody>{table.map((row, index) => <tr key={index} className="border-t border-white/5">{circuit.inputNames.map(name => <td className="p-2 text-zinc-400" key={name}>{Number(row.inputs[name])}</td>)}<td className={`p-2 ${row.authorized ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(row.authorized)}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
