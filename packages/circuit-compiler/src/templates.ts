import { CircuitBuilder } from './builder.js';
import type { CompiledCircuit } from '@latchwork/shared';

/**
 * Template 1: Availability Only (Simple 2-of-3 SLA)
 * Authorized if at least 2 of the 3 witnesses report availability >= threshold.
 */
export function buildAvailabilityTemplate(): CompiledCircuit {
  const b = new CircuitBuilder();
  const w1 = b.addInput('w1_avail_ok');
  const w2 = b.addInput('w2_avail_ok');
  const w3 = b.addInput('w3_avail_ok');

  const quorum = b.majority3(w1, w2, w3);
  b.setOutputs([{ wire: quorum, name: 'settlement_authorized' }]);

  return b.compile(
    'Availability Quorum (2-of-3)',
    'Requires at least 2 of 3 independent witnesses to verify uptime SLA compliance.',
  );
}

/**
 * Template 2: Availability AND Latency (Strict SLA)
 * Each witness must verify both uptime AND p95 latency.
 * Authorized if at least 2 of 3 witnesses report both conditions met.
 */
export function buildAvailabilityAndLatencyTemplate(): CompiledCircuit {
  const b = new CircuitBuilder();
  const w1_avail = b.addInput('w1_avail_ok');
  const w1_lat = b.addInput('w1_lat_ok');
  const w2_avail = b.addInput('w2_avail_ok');
  const w2_lat = b.addInput('w2_lat_ok');
  const w3_avail = b.addInput('w3_avail_ok');
  const w3_lat = b.addInput('w3_lat_ok');

  const w1_ok = b.and(w1_avail, w1_lat);
  const w2_ok = b.and(w2_avail, w2_lat);
  const w3_ok = b.and(w3_avail, w3_lat);

  const quorum = b.majority3(w1_ok, w2_ok, w3_ok);
  b.setOutputs([{ wire: quorum, name: 'settlement_authorized' }]);

  return b.compile(
    'Availability + Latency SLA (2-of-3)',
    'Requires at least 2 witnesses to verify uptime AND p95 latency thresholds.',
  );
}

/**
 * Template 3: Enterprise SLA Policy
 * Witness quorum (2-of-3) AND agreement authorization AND NOT in active dispute.
 */
export function buildEnterpriseSlaTemplate(): CompiledCircuit {
  const b = new CircuitBuilder();
  const w1_ok = b.addInput('w1_verified');
  const w2_ok = b.addInput('w2_verified');
  const w3_ok = b.addInput('w3_verified');
  const agreement_auth = b.addInput('agreement_auth');
  const dispute_active = b.addInput('dispute_active');

  const quorum = b.majority3(w1_ok, w2_ok, w3_ok);
  const no_dispute = b.not(dispute_active);
  const quorum_and_auth = b.and(quorum, agreement_auth);
  const authorized = b.and(quorum_and_auth, no_dispute);

  b.setOutputs([{ wire: authorized, name: 'settlement_authorized' }]);

  return b.compile(
    'Enterprise SLA + Dispute Check',
    'Enforces 2-of-3 witness consensus, valid customer authorization, and absence of unresolved disputes.',
  );
}

