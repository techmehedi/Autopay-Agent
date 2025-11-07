import type { NextApiRequest, NextApiResponse } from 'next';
import { auditStore } from '@/lib/auditStore';
import crypto from 'crypto';

function signPayload(secret: string, payload: string, timestamp: number) {
  const toSign = `${timestamp}.${payload}`;
  const sig = crypto.createHmac('sha256', secret).update(toSign).digest('hex');
  return sig;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.DEMO_WEBHOOK_SECRET || 'demo_secret';
  const entries = auditStore.getAllEntries();
  const last = entries[entries.length - 1];

  const event = {
    id: `evt_${Date.now()}`,
    type: 'claim.decided',
    createdAt: new Date().toISOString(),
    data: last || null,
  };

  const payload = JSON.stringify(event);
  const ts = Date.now();
  const signature = signPayload(secret, payload, ts);

  return res.status(200).json({
    destination: 'https://example.com/webhooks/locus',
    headers: {
      'X-Locus-Signature': signature,
      'X-Locus-Timestamp': ts,
      'Content-Type': 'application/json',
    },
    payload: event,
    note: 'Preview only. Implement your receiver to validate signature = HMAC-SHA256(ts + "." + body).',
  });
}


