import type { FastifyPluginAsync } from 'fastify';
import {
  CircuitBuilder,
  simulateCircuit,
  generateTruthTable,
  buildAvailabilityTemplate,
  buildAvailabilityAndLatencyTemplate,
  buildEnterpriseSlaTemplate,
} from '@latchwork/circuit-compiler';
import type { CompiledCircuit } from '@latchwork/shared';

export const circuitRoutes: FastifyPluginAsync = async (fastify) => {
  // Pre-compiled templates
  fastify.get('/templates', async () => {
    const t1 = buildAvailabilityTemplate();
    const t2 = buildAvailabilityAndLatencyTemplate();
    const t3 = buildEnterpriseSlaTemplate();

    return [
      {
        id: 'template-avail-2-of-3',
        name: t1.name,
        description: t1.description,
        circuit: t1,
        truthTable: generateTruthTable(t1),
      },
      {
        id: 'template-avail-lat-2-of-3',
        name: t2.name,
        description: t2.description,
        circuit: t2,
        truthTable: generateTruthTable(t2),
      },
      {
        id: 'template-enterprise-sla',
        name: t3.name,
        description: t3.description,
        circuit: t3,
        truthTable: generateTruthTable(t3),
      },
    ];
  });

  // Compile custom visual logic
  fastify.post('/compile', async (req) => {
    const body = req.body as {
      name: string;
      description: string;
      inputs: string[];
      rules: Array<{
        type: 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'MAJORITY3';
        inputWires: number[];
        outputName?: string;
      }>;
    };

    const b = new CircuitBuilder();
    const wireMap: Record<string, number> = {};

    for (const inName of body.inputs) {
      wireMap[inName] = b.addInput(inName);
    }

    let lastWire = 0;
    for (const rule of body.rules) {
      if (rule.type === 'AND') {
        lastWire = b.and(rule.inputWires[0], rule.inputWires[1]);
      } else if (rule.type === 'OR') {
        lastWire = b.or(rule.inputWires[0], rule.inputWires[1]);
      } else if (rule.type === 'NOT') {
        lastWire = b.not(rule.inputWires[0]);
      } else if (rule.type === 'NAND') {
        lastWire = b.nand(rule.inputWires[0], rule.inputWires[1]);
      } else if (rule.type === 'XOR') {
        lastWire = b.xor(rule.inputWires[0], rule.inputWires[1]);
      } else if (rule.type === 'MAJORITY3') {
        lastWire = b.majority3(rule.inputWires[0], rule.inputWires[1], rule.inputWires[2]);
      }
    }

    b.setOutputs([{ wire: lastWire, name: 'settlement_authorized' }]);
    const compiled = b.compile(body.name || 'Custom Circuit', body.description || '');

    return {
      compiled,
      truthTable: generateTruthTable(compiled),
    };
  });

  // Local simulator endpoint
  fastify.post('/simulate', async (req, reply) => {
    const { circuit, inputs } = req.body as {
      circuit: CompiledCircuit;
      inputs: boolean[];
    };

    if (!circuit || !inputs) {
      return reply.status(400).send({ error: 'Circuit and inputs required' });
    }

    try {
      const result = simulateCircuit(circuit, inputs);
      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Truth table generator
  fastify.post('/truth-table', async (req, reply) => {
    const { circuit } = req.body as { circuit: CompiledCircuit };
    if (!circuit) {
      return reply.status(400).send({ error: 'Circuit required' });
    }

    const tt = generateTruthTable(circuit);
    return { truthTable: tt };
  });
};

