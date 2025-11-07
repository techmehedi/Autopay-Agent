'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';

export interface DecisionEntry {
  timestamp: string;
  status: 'approved' | 'rejected' | 'review';
  amount: number;
  purpose: string;
  recipient?: string;
  reason?: string;
  txId?: string;
  error?: string;
}

interface DecisionListProps {
  entries: DecisionEntry[];
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'json') => void;
}

export default function DecisionList({ entries, onRefresh, onExport }: DecisionListProps) {
  const exportClick = async () => {
    if (onExport) return onExport('csv');
    // Default implementation: attempt CSV, fallback to JSON
    const url = '/api/audit?format=csv';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('CSV not available');
      const csv = await res.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit-export-${Date.now()}.csv`;
      link.click();
    } catch {
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit-export-${Date.now()}.json`;
      link.click();
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recent Decisions</h2>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onRefresh}>Refresh</Button>
          <Button variant="ghost" onClick={exportClick}>Export</Button>
        </div>
      </div>
      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-slate-400">No entries yet.</CardContent>
        </Card>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Status</TH>
              <TH>Timestamp</TH>
              <TH>Amount</TH>
              <TH>Purpose</TH>
              <TH>Recipient</TH>
              <TH>Tx ID</TH>
            </TR>
          </THead>
          <tbody>
            {entries.slice().reverse().map((entry, i) => (
              <TR key={i}>
                <TD>
                  {(() => {
                    const cls =
                      entry.status === 'approved'
                        ? 'border-green-700 bg-green-900/50 text-green-200'
                        : entry.status === 'review'
                          ? 'border-amber-700 bg-amber-900/50 text-amber-200'
                          : 'border-red-700 bg-red-900/50 text-red-200';
                    return <Badge className={cls}>{entry.status}</Badge>;
                  })()}
                </TD>
                <TD>{new Date(entry.timestamp).toLocaleString()}</TD>
                <TD>${(typeof entry.amount === 'number' ? entry.amount : parseFloat(String(entry.amount)) || 0).toFixed(2)}</TD>
                <TD className="truncate max-w-[280px]" title={entry.purpose}>{entry.purpose}</TD>
                <TD className="truncate max-w-[260px]" title={entry.recipient}>{entry.recipient || '-'}</TD>
                <TD className="truncate max-w-[260px]" title={entry.txId}>{entry.txId || '-'}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}


