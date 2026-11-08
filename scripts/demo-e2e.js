// Read-only integration check. This does not demonstrate escrow settlement.
import assert from 'node:assert/strict';
import { createPublicClient, http, keccak256 } from 'viem';
import { CHAINS, TAPEOUT_CONFIG } from '@latchwork/shared';
import { CircuitBuilder } from '@latchwork/circuit-compiler';
import { TapeOutClient } from '@latchwork/tapeout-adapter';

async function main() {
  const rpc = process.env.XLAYER_RPC_URL || CHAINS.XLAYER_MAINNET.rpcUrls[0];
  const publicClient = createPublicClient({ transport: http(rpc) });
  assert.equal(await publicClient.getChainId(), 196, 'Expected X Layer mainnet');
  const code = await publicClient.getCode({ address: TAPEOUT_CONFIG.CPU0_ADDRESS });
  assert.ok(code && code !== '0x', 'No processor bytecode at configured address');
  console.log('Read-only TapeOut check; no funds or transactions.');
  console.log(JSON.stringify({ chainId: 196, block: String(await publicClient.getBlockNumber()), processor: TAPEOUT_CONFIG.CPU0_ADDRESS, codeHash: keccak256(code) }, null, 2));
  const adapter = new TapeOutClient(rpc, TAPEOUT_CONFIG.CPU0_ADDRESS);
  const info = await adapter.getCircuitInfo(1);
  assert.equal(info.numInputs, 2);
  assert.equal(info.numOutputs, 1);
  assert.equal(info.numGates, 4);
  const builder = new CircuitBuilder();
  const a = builder.addInput('A');
  const b = builder.addInput('B');
  builder.setOutputs([{ wire: builder.xor(a, b), name: 'xor' }]);
  const circuit = builder.compile('XOR adapter check', 'Existing ecosystem circuit 1');
  const result = await adapter.verifyEquivalence(circuit, 1);
  assert.equal(result.totalChecked, 4);
  assert.equal(result.mismatches, 0);
  assert.equal(result.isEquivalent, true);
  console.log('PASS: existing circuit 1 metadata and all four XOR input cases agree.');
  console.log('LATCHWORK SLA deployment, escrow settlement and withdrawals are not exercised.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
