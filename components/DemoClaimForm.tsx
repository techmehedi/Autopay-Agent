'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ExplanationItem {
  id: string;
  label?: string;
  reason: string;
  weight?: number;
}

export interface DemoClaimResponse {
  status: 'approved' | 'rejected';
  amount: number;
  purpose: string;
  reason?: string;
  txId?: string;
  error?: string;
  decision?: 'approve' | 'deny' | 'review';
  confidence?: number;
  explanations?: ExplanationItem[];
  claimId?: string;
  traceId?: string;
}

interface DemoClaimFormProps {
  onResult?: (result: DemoClaimResponse) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export default function DemoClaimForm({ onResult, onLoadingChange }: DemoClaimFormProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const setLoadingState = (v: boolean) => {
    setLoading(v);
    onLoadingChange?.(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoadingState(true);

    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      const data: DemoClaimResponse = await response.json();
      const normalized: DemoClaimResponse = {
        ...data,
        amount: typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount)) || 0,
      };
      onResult?.(normalized);
    } catch (error: any) {
      onResult?.({
        status: 'rejected',
        amount: 0,
        purpose: '',
        reason: `Error: ${error.message}`,
      } as DemoClaimResponse);
    } finally {
      setLoadingState(false);
    }
  };

  return (
    <Card className="tilt mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Submit an expense</CardTitle>
        <CardDescription>Describe the expense in plain English. The agent will parse the amount, purpose, and recipient.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="expense-text">Expense Description</Label>
            <Textarea
              id="expense-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g., Reimburse $0.35 for coffee"
              rows={3}
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading || !text.trim()} className="gap-2">
              {loading && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
              )}
              {loading ? 'Processing...' : 'Submit Claim'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setText('')}>Clear</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


