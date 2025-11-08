import type { NextApiRequest, NextApiResponse } from 'next';
import { getPolicy, setPolicy, type Policy } from '@/lib/policy';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json(getPolicy());
    }
    if (req.method === 'PUT') {
      const body = req.body as Partial<Policy>;
      if (body.perTxnMax !== undefined && body.perTxnMax < 0) {
        return res.status(400).json({ error: 'perTxnMax must be >= 0' });
      }
      if (body.dailyMax !== undefined && body.dailyMax < 0) {
        return res.status(400).json({ error: 'dailyMax must be >= 0' });
      }
      if (body.whitelistedContacts && !Array.isArray(body.whitelistedContacts)) {
        return res.status(400).json({ error: 'whitelistedContacts must be an array of strings' });
      }
      const updated = setPolicy(body);
      return res.status(200).json(updated);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}






