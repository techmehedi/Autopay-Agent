import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/audit';
import { auditStore } from '@/lib/auditStore';

// Mock the audit store
jest.mock('@/lib/auditStore', () => ({
  auditStore: {
    getAllEntries: jest.fn(),
  },
}));

describe('/api/audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all audit entries', async () => {
    const mockEntries = [
      {
        timestamp: '2024-01-01T12:00:00.000Z',
        status: 'approved',
        amount: 0.35,
        purpose: 'coffee',
        txId: 'tx-123',
      },
      {
        timestamp: '2024-01-01T13:00:00.000Z',
        status: 'rejected',
        amount: 0.60,
        purpose: 'lunch',
        reason: 'Exceeds limit',
      },
    ];

    (auditStore.getAllEntries as jest.Mock).mockReturnValue(mockEntries);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data).toHaveLength(2);
    expect(data).toEqual(mockEntries);
  });

  it('should reject invalid method', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it('should handle errors gracefully', async () => {
    (auditStore.getAllEntries as jest.Mock).mockImplementation(() => {
      throw new Error('Database error');
    });

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data.error).toBeDefined();
  });
});

