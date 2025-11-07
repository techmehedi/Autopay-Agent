import * as fs from 'fs';
import * as path from 'path';

export interface AuditEntry {
  timestamp: string;
  status: 'approved' | 'rejected' | 'review';
  amount: number;
  purpose: string;
  recipient?: string;
  reason?: string;
  txId?: string;
  error?: string;
}

const AUDIT_FILE = path.join(process.cwd(), 'audit-log.json');

function readAuditLog(): AuditEntry[] {
  try {
    if (!fs.existsSync(AUDIT_FILE)) {
      return [];
    }
    const content = fs.readFileSync(AUDIT_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading audit log:', error);
    return [];
  }
}

function writeAuditLog(entries: AuditEntry[]): void {
  try {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(entries, null, 2));
  } catch (error) {
    console.error('Error writing audit log:', error);
  }
}

export const auditStore = {
  addEntry(entry: AuditEntry): void {
    const entries = readAuditLog();
    entries.push(entry);
    writeAuditLog(entries);
  },

  getAllEntries(): AuditEntry[] {
    return readAuditLog();
  },

  getDailyTotal(date: string): number {
    const entries = readAuditLog();
    return entries
      .filter((entry) => {
        const entryDate = entry.timestamp.split('T')[0];
        return entryDate === date && entry.status === 'approved';
      })
      .reduce((sum, entry) => sum + entry.amount, 0);
  },

  toCSV(customEntries?: AuditEntry[]): string {
    const entries = customEntries ?? readAuditLog();
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
      ].map((v) => `"${v}` + `"`);
      rows.push(vals.join(','));
    }
    return rows.join('\n');
  },
};


