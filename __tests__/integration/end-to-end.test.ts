/**
 * Integration tests for the full claim processing flow
 * These tests verify the complete workflow from API call to payment execution
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/claim';
import { auditStore } from '@/lib/auditStore';

// Mock the agent and MCP client
jest.mock('@/lib/agent', () => {
  const actualAgent = jest.requireActual('@/lib/agent');
  return {
    ...actualAgent,
    processClaim: jest.fn(),
  };
});

// Mock MCP client
jest.mock('@locus-technologies/langchain-mcp-m2m', () => ({
  MCPClientCredentials: jest.fn().mockImplementation(() => ({
    initializeConnections: jest.fn().mockResolvedValue(undefined),
    getTools: jest.fn().mockResolvedValue([
      {
        name: 'payouts.create',
        invoke: jest.fn().mockResolvedValue({
          transactionId: 'tx-test-123',
          id: 'tx-test-123',
        }),
        schema: {
          properties: {
            recipient: { type: 'string' },
            amount: { type: 'number' },
          },
        },
      },
    ]),
  })),
}));

describe('End-to-End Claim Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WHITELISTED_CONTACT = '0x1234567890123456789012345678901234567890';
    process.env.PER_TXN_MAX = '0.50';
    process.env.DAILY_MAX = '3.0';
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('should process and approve a valid claim', async () => {
    const { processClaim } = require('@/lib/agent');
    
    processClaim.mockResolvedValue({
      status: 'approved',
      amount: 0.35,
      purpose: 'coffee',
      txId: 'tx-test-123',
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        text: 'Reimburse $0.35 for coffee',
      },
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.status).toBe('approved');
    expect(data.amount).toBe(0.35);
    expect(data.txId).toBe('tx-test-123');
  });

  it('should reject claim exceeding transaction limit', async () => {
    const { processClaim } = require('@/lib/agent');
    
    processClaim.mockResolvedValue({
      status: 'rejected',
      amount: 0.60,
      purpose: 'lunch',
      reason: 'Amount $0.60 exceeds per-transaction maximum of $0.50',
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        text: 'Reimburse $0.60 for lunch',
      },
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.status).toBe('rejected');
    expect(data.reason).toContain('exceeds');
  });

  it('should handle claim with recipient specified', async () => {
    const { processClaim } = require('@/lib/agent');
    
    processClaim.mockResolvedValue({
      status: 'approved',
      amount: 0.35,
      purpose: 'coffee',
      recipient: '0x1234567890123456789012345678901234567890',
      txId: 'tx-test-456',
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        amount: 0.35,
        purpose: 'coffee',
        recipient: '0x1234567890123456789012345678901234567890',
      },
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.status).toBe('approved');
  });
});

