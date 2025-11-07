import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface ParsedClaim {
  amount: number;
  purpose: string;
  recipient?: string;
}

// Structured claim (API-level) — kept lightweight to avoid external deps
export interface ClaimInput {
  claimId?: string;
  customerId?: string;
  amount: number;
  currency?: string;
  submittedAt?: string; // ISO timestamp
  meta?: Record<string, unknown>;
}

export interface NormalizedClaim extends ClaimInput {
  amount: number; // coerced to number
  currency: string; // defaulted to USD
  submittedAt?: string; // validated ISO
}

/**
 * Normalize and validate a structured claim input.
 * - Coerces amount to number (>=0)
 * - Uppercases currency and defaults to USD
 * - Validates submittedAt as ISO if provided
 */
export function normalizeClaim(input: Partial<ClaimInput> | any): NormalizedClaim {
  const amountNum = typeof input?.amount === 'number' ? input.amount : parseFloat(String(input?.amount ?? 0)) || 0;
  const currency = (input?.currency || 'USD').toString().trim().toUpperCase();
  const claimId = input?.claimId ? String(input.claimId) : undefined;
  const customerId = input?.customerId ? String(input.customerId) : undefined;
  const meta = (input?.meta && typeof input.meta === 'object') ? input.meta as Record<string, unknown> : undefined;

  let submittedAt: string | undefined = undefined;
  if (input?.submittedAt) {
    const date = new Date(String(input.submittedAt));
    if (!isNaN(date.getTime())) {
      submittedAt = date.toISOString();
    }
  }

  if (amountNum < 0) {
    throw new Error('Amount must be >= 0');
  }

  return {
    claimId,
    customerId,
    amount: amountNum,
    currency,
    submittedAt,
    meta,
  };
}

export async function parseClaim(text: string): Promise<ParsedClaim> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Parse this expense claim text and extract the amount (in USD) and purpose. Return ONLY a valid JSON object with "amount" (number) and "purpose" (string). If recipient is mentioned, include "recipient" field. If no amount is found, use 0. Text: "${text}"`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response (OpenAI JSON mode should return valid JSON)
    let jsonText = content.trim();
    // Handle markdown code blocks if present (fallback)
    if (jsonText.startsWith('```')) {
      const lines = jsonText.split('\n');
      jsonText = lines.slice(1, -1).join('\n').trim();
    }
    if (jsonText.startsWith('```json')) {
      const lines = jsonText.split('\n');
      jsonText = lines.slice(1, -1).join('\n').trim();
    }

    const parsed = JSON.parse(jsonText) as ParsedClaim;

    // Validate amount
    if (typeof parsed.amount !== 'number' || parsed.amount < 0) {
      throw new Error('Invalid amount in parsed claim');
    }

    return {
      amount: parsed.amount,
      purpose: parsed.purpose || text,
      recipient: parsed.recipient,
    };
  } catch (error: any) {
    // Fallback: try to extract amount manually
    const amountMatch = text.match(/\$?([\d.]+)/);
    const fallbackAmount = amountMatch ? parseFloat(amountMatch[1]) : 0;

    return {
      amount: fallbackAmount,
      purpose: text,
    };
  }
}

