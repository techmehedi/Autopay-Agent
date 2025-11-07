import { MCPClientCredentials } from '@locus-technologies/langchain-mcp-m2m';

let mcpClient: MCPClientCredentials | null = null;

export async function initClient(): Promise<MCPClientCredentials> {
  if (mcpClient) {
    return mcpClient;
  }

  const client = new MCPClientCredentials({
    mcpServers: {
      locus: {
        url: process.env.LOCUS_MCP_URL!,
        auth: {
          clientId: process.env.LOCUS_CLIENT_ID!,
          clientSecret: process.env.LOCUS_CLIENT_SECRET!,
        },
      },
    },
  });

  await client.initializeConnections();
  mcpClient = client;
  return client;
}

export async function sendPayout(
  recipient: string,
  amount: number,
  currency: string = 'USDC'
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    const client = await initClient();
    // Use type assertion since callTool may not be in the type definition
    const result = await (client as any).callTool('locus', 'payouts.create', {
      recipient,
      amount,
      currency,
    });

    return {
      success: true,
      txId: result?.transactionId || result?.id || 'unknown',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error during payout',
    };
  }
}







