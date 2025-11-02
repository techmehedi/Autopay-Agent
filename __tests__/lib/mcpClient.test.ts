import { initClient, sendPayout } from '@/lib/mcpClient';
import { MCPClientCredentials } from '@locus-technologies/langchain-mcp-m2m';

// Mock the MCP client
jest.mock('@locus-technologies/langchain-mcp-m2m', () => ({
  MCPClientCredentials: jest.fn().mockImplementation(() => ({
    initializeConnections: jest.fn().mockResolvedValue(undefined),
    callTool: jest.fn().mockResolvedValue({
      transactionId: 'tx-mock-123',
      id: 'tx-mock-123',
    }),
  })),
}));

describe('MCP Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LOCUS_CLIENT_ID = 'test-client-id';
    process.env.LOCUS_CLIENT_SECRET = 'test-client-secret';
    process.env.LOCUS_MCP_URL = 'https://mcp.paywithlocus.com/mcp';
  });

  describe('initClient', () => {
    it('should initialize MCP client with credentials', async () => {
      const client = await initClient();
      
      expect(MCPClientCredentials).toHaveBeenCalledWith({
        mcpServers: {
          locus: {
            url: 'https://mcp.paywithlocus.com/mcp',
            auth: {
              clientId: 'test-client-id',
              clientSecret: 'test-client-secret',
            },
          },
        },
      });
      expect(client).toBeDefined();
    });

    it('should reuse existing client instance', async () => {
      const client1 = await initClient();
      const client2 = await initClient();
      
      expect(client1).toBe(client2);
    });
  });

  describe('sendPayout', () => {
    it('should send payout successfully', async () => {
      const result = await sendPayout(
        '0x1234567890123456789012345678901234567890',
        0.35,
        'USDC'
      );

      expect(result.success).toBe(true);
      expect(result.txId).toBe('tx-mock-123');
    });

    it('should handle payout errors', async () => {
      const MCPClientCredentialsMock = MCPClientCredentials as jest.Mock;
      const mockClient = {
        initializeConnections: jest.fn().mockResolvedValue(undefined),
        callTool: jest.fn().mockRejectedValue(new Error('Payment failed')),
      };
      MCPClientCredentialsMock.mockImplementation(() => mockClient);

      // Reset module to get new instance
      jest.resetModules();
      const { sendPayout: sendPayoutNew } = require('@/lib/mcpClient');
      
      const result = await sendPayoutNew(
        '0x1234567890123456789012345678901234567890',
        0.35
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should extract transaction ID from various formats', async () => {
      const MCPClientCredentialsMock = MCPClientCredentials as jest.Mock;
      
      // Test with transactionId
      let mockClient = {
        initializeConnections: jest.fn().mockResolvedValue(undefined),
        callTool: jest.fn().mockResolvedValue({ transactionId: 'tx-123' }),
      };
      MCPClientCredentialsMock.mockImplementation(() => mockClient);
      jest.resetModules();
      const { sendPayout: sendPayout1 } = require('@/lib/mcpClient');
      const result1 = await sendPayout1('0x123', 0.35);
      expect(result1.txId).toBe('tx-123');

      // Test with id
      mockClient = {
        initializeConnections: jest.fn().mockResolvedValue(undefined),
        callTool: jest.fn().mockResolvedValue({ id: 'tx-456' }),
      };
      MCPClientCredentialsMock.mockImplementation(() => mockClient);
      jest.resetModules();
      const { sendPayout: sendPayout2 } = require('@/lib/mcpClient');
      const result2 = await sendPayout2('0x123', 0.35);
      expect(result2.txId).toBe('tx-456');
    });
  });
});

