import type { NextApiRequest, NextApiResponse } from 'next';
import { auditStore } from '@/lib/auditStore';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const entries = auditStore.getAllEntries();
    return res.status(200).json(entries);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

