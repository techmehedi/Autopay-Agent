import type { NextApiRequest, NextApiResponse } from 'next';
import { processClaim } from '@/lib/agent';

interface ClaimRequest {
  text?: string;
  amount?: number;
  purpose?: string;
  recipient?: string;
}

interface ClaimResponse {
  status: 'approved' | 'rejected';
  amount: number;
  purpose: string;
  reason?: string;
  txId?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClaimResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'rejected',
      amount: 0,
      purpose: '',
      reason: 'Method not allowed. Use POST.',
    });
  }

  try {
    const body: ClaimRequest = req.body;
    let userInput: string;

    // Prepare user input for the agent
    if (body.text) {
      userInput = body.text;
    } else if (body.amount !== undefined && body.purpose) {
      // Construct natural language from structured input
      userInput = `Reimburse $${body.amount.toFixed(2)} for ${body.purpose}${body.recipient ? ` to ${body.recipient}` : ''}`;
    } else {
      return res.status(400).json({
        status: 'rejected',
        amount: 0,
        purpose: '',
        reason: 'Missing required fields: provide either "text" or both "amount" and "purpose".',
      });
    }

    // Process using LangChain agent
    const result = await processClaim(userInput);

    // Ensure amount is always a number
    const normalizedResult: ClaimResponse = {
      ...result,
      amount: typeof result.amount === 'number' ? result.amount : parseFloat(String(result.amount)) || 0,
    };

    return res.status(200).json(normalizedResult);
  } catch (error: any) {
    console.error('Error processing claim:', error);
    return res.status(500).json({
      status: 'rejected',
      amount: 0,
      purpose: '',
      reason: `Internal error: ${error.message}`,
    });
  }
}

