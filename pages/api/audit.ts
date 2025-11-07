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
    let entries = auditStore.getAllEntries();

    const { limit, fromTime, decision, format } = req.query as {
      limit?: string;
      fromTime?: string;
      decision?: string;
      format?: string;
    };

    // Filter by fromTime (inclusive)
    if (fromTime) {
      const ts = new Date(fromTime);
      if (!isNaN(ts.getTime())) {
        entries = entries.filter((e: any) => new Date(e.timestamp).getTime() >= ts.getTime());
      }
    }

    // Filter by decision/status
    if (decision) {
      const map: Record<string, string> = { approve: 'approved', deny: 'rejected', review: 'review' };
      const target = map[decision] || decision;
      entries = entries.filter((e: any) => String(e.status).toLowerCase() === String(target).toLowerCase());
    }

    // Sort by timestamp ascending by default
    entries = entries.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Apply limit
    if (limit) {
      const n = parseInt(limit, 10);
      if (!isNaN(n) && n > 0) {
        entries = entries.slice(-n);
      }
    }

    if (format === 'csv') {
      // CSV export
      const header = ['timestamp', 'status', 'amount', 'purpose', 'recipient', 'txId', 'reason', 'error'];
      const rows = [header.join(',')];
      for (const e of entries) {
        const vals = [
          e.timestamp,
          e.status,
          typeof e.amount === 'number' ? e.amount.toFixed(2) : String(e.amount ?? ''),
          (e.purpose ?? '').toString().replaceAll('"', '""'),
          (e.recipient ?? '').toString().replaceAll('"', '""'),
          (e.txId ?? '').toString().replaceAll('"', '""'),
          (e.reason ?? '').toString().replaceAll('"', '""'),
          (e.error ?? '').toString().replaceAll('"', '""'),
        ].map((v) => `"${v}"`);
        rows.push(vals.join(','));
      }
      const csv = rows.join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.status(200).send(csv as any);
    }

    return res.status(200).json(entries);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

