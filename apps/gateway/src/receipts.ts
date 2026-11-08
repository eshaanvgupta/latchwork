import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, toHex, stringToBytes, hashMessage, type Hex } from 'viem';
import { prisma } from '@latchwork/database';
import type { UsageReceipt } from '@latchwork/shared';

if (process.env.NODE_ENV === 'production' && !process.env.GATEWAY_SIGNER_PRIVATE_KEY) {
  throw new Error('Production requires GATEWAY_SIGNER_PRIVATE_KEY');
}
const gatewayPrivateKey = (process.env.GATEWAY_SIGNER_PRIVATE_KEY ||
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as Hex;

export const gatewaySignerAccount = privateKeyToAccount(gatewayPrivateKey);

export async function createAndSignUsageReceipt(params: {
  agreementId: string;
  epochId: number;
  requestId: string;
  latencyMs: number;
  statusCode: number;
  requestBody: string;
  responseBody: string;
  persist?: boolean;
}): Promise<UsageReceipt> {
  const timestamp = Math.floor(Date.now() / 1000);
  const requestHash = keccak256(stringToBytes(params.requestBody || ''));
  const responseHash = keccak256(stringToBytes(params.responseBody || ''));
  const receiptId = `rcpt_${params.requestId}`;

  const payload = JSON.stringify({
    receiptId,
    agreementId: params.agreementId,
    epochId: params.epochId,
    requestId: params.requestId,
    timestamp,
    latencyMs: params.latencyMs,
    statusCode: params.statusCode,
    requestHash,
    responseHash,
  });

  const signature = await gatewaySignerAccount.signMessage({
    message: payload,
  });

  const receipt: UsageReceipt = {
    receiptId,
    agreementId: params.agreementId,
    epochId: params.epochId,
    requestId: params.requestId,
    timestamp,
    latencyMs: params.latencyMs,
    statusCode: params.statusCode,
    requestHash,
    responseHash,
    signature,
  };

  // Persist receipt to durable database
  if (params.persist !== false) {
    await prisma.usageReceiptRecord.create({
      data: {
        agreementId: params.agreementId,
        epochId: params.epochId,
        requestId: params.requestId,
        timestamp: new Date(timestamp * 1000),
        latencyMs: params.latencyMs,
        statusCode: params.statusCode,
        requestHash,
        responseHash,
        signature,
      },
    });
  }

  return receipt;
}

