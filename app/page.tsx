'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface ClaimResponse {
  status: 'approved' | 'rejected';
  amount: number;
  purpose: string;
  reason?: string;
  txId?: string;
  error?: string;
}

interface AuditEntry {
  timestamp: string;
  status: 'approved' | 'rejected';
  amount: number;
  purpose: string;
  recipient?: string;
  reason?: string;
  txId?: string;
  error?: string;
}

export default function Home() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClaimResponse | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      const data: ClaimResponse = await response.json();
      // Ensure amount is a number
      const normalizedData: ClaimResponse = {
        ...data,
        amount: typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount)) || 0,
      };
      setResult(normalizedData);
      loadAuditLog();
    } catch (error: any) {
      setResult({
        status: 'rejected',
        amount: 0,
        purpose: '',
        reason: `Error: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLog = async () => {
    try {
      const response = await fetch('/api/audit');
      const data: AuditEntry[] = await response.json();
      // Ensure all amounts are numbers
      const normalizedData: AuditEntry[] = data.map(entry => ({
        ...entry,
        amount: typeof entry.amount === 'number' ? entry.amount : parseFloat(String(entry.amount)) || 0,
      }));
      setAuditLog(normalizedData);
    } catch (error) {
      console.error('Error loading audit log:', error);
    }
  };

  // Load audit log on mount
  useEffect(() => {
    loadAuditLog();
  }, []);

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>AutoPay Agent</h1>
        <p className={styles.description}>
          Submit an expense claim to be automatically processed and paid.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="expense-text" className={styles.label}>
              Expense Description
            </label>
            <textarea
              id="expense-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g., Reimburse $0.35 for coffee"
              className={styles.textarea}
              rows={3}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !text.trim()}
            className={styles.button}
          >
            {loading ? 'Processing...' : 'Submit Claim'}
          </button>
        </form>

        {result && (
          <div
            className={`${styles.result} ${
              result.status === 'approved' ? styles.approved : styles.rejected
            }`}
          >
            <h2>
              Status: {result.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
            </h2>
            <p>
              <strong>Amount:</strong> ${(typeof result.amount === 'number' ? result.amount : parseFloat(String(result.amount)) || 0).toFixed(2)}
            </p>
            <p>
              <strong>Purpose:</strong> {result.purpose}
            </p>
            {result.txId && (
              <p>
                <strong>Transaction ID:</strong> {result.txId}
              </p>
            )}
            {result.reason && (
              <p>
                <strong>Reason:</strong> {result.reason}
              </p>
            )}
          </div>
        )}

        <div className={styles.auditSection}>
          <h2 className={styles.auditTitle}>Audit Log</h2>
          <button
            onClick={loadAuditLog}
            className={styles.refreshButton}
          >
            Refresh Log
          </button>
          <div className={styles.auditLog}>
            {auditLog.length === 0 ? (
              <p className={styles.noEntries}>No entries yet.</p>
            ) : (
              auditLog.slice().reverse().map((entry, index) => (
                <div
                  key={index}
                  className={`${styles.auditEntry} ${
                    entry.status === 'approved' ? styles.auditApproved : styles.auditRejected
                  }`}
                >
                  <div className={styles.auditHeader}>
                    <span className={styles.auditStatus}>
                      {entry.status === 'approved' ? '✓' : '✗'}
                    </span>
                    <span className={styles.auditDate}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.auditDetails}>
                    <p>
                      <strong>Amount:</strong> ${(typeof entry.amount === 'number' ? entry.amount : parseFloat(String(entry.amount)) || 0).toFixed(2)}
                    </p>
                    <p>
                      <strong>Purpose:</strong> {entry.purpose}
                    </p>
                    {entry.recipient && (
                      <p>
                        <strong>Recipient:</strong> {entry.recipient}
                      </p>
                    )}
                    {entry.txId && (
                      <p>
                        <strong>Tx ID:</strong> {entry.txId}
                      </p>
                    )}
                    {entry.reason && (
                      <p className={styles.auditReason}>
                        <strong>Reason:</strong> {entry.reason}
                      </p>
                    )}
                    {entry.error && (
                      <p className={styles.auditError}>
                        <strong>Error:</strong> {entry.error}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

