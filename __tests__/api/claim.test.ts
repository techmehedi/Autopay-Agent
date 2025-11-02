import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/claim';
import { processClaim } from '@/lib/agent';

// Mock the agent
jest.mock('@/lib/agent', () => ({
  processClaim: jest.fn(),
}));

describe('/api/claim', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle POST request with text', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        text: 'Reimburse $0.35 for coffee',
      },
    });

    (processClaim as jest.Mock).mockResolvedValue({
      status: 'approved',
      amount: 0.35,
      purpose: 'coffee',
      txId: 'tx-123',
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.status).toBe('approved');
    expect(data.amount).toBe(0.35);
    expect(processClaim).toHaveBeenCalledWith('Reimburse $0.35 for coffee');
  });

  it('should handle POST request with structured data', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        amount: 0.35,
        purpose: 'coffee',
      },
    });

    (processClaim as jest.Mock).mockResolvedValue({
      status: 'approved',
      amount: 0.35,
      purpose: 'coffee',
      txId: 'tx-123',
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.status).toBe('approved');
  });

  it('should reject invalid method', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
    const data = JSON.parse(res._getData());
    expect(data.status).toBe('rejected');
  });

  it('should reject missing required fields', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {},
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.status).toBe('rejected');
    expect(data.reason).toContain('Missing required fields');
  });

  it('should handle errors gracefully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        text: 'Reimburse $0.35 for coffee',
      },
    });

    (processClaim as jest.Mock).mockRejectedValue(new Error('Agent error'));

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data.status).toBe('rejected');
  });

  it('should normalize amount to number', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        text: 'Reimburse $0.35 for coffee',
      },
    });

    (processClaim as jest.Mock).mockResolvedValue({
      status: 'approved',
      amount: '0.35', // String amount
      purpose: 'coffee',
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(typeof data.amount).toBe('number');
    expect(data.amount).toBe(0.35);
  });
});

