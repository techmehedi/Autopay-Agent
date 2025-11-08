'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type Policy = {
  whitelistedContacts: string[];
  defaultContact?: string;
  perTxnMax: number;
  dailyMax: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (p: Policy) => void;
}

export default function PolicySettings({ open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<Policy>({
    whitelistedContacts: [],
    defaultContact: undefined,
    perTxnMax: 0.5,
    dailyMax: 3.0,
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await fetch('/api/policy');
      const p = await res.json();
      setState(p);
    })();
  }, [open]);

  const save = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      const p = await res.json();
      onSaved?.(p);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Policy Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Whitelisted Contacts (comma-separated)</Label>
            <Input
              className="mt-1"
              value={state.whitelistedContacts.join(', ')}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  whitelistedContacts: e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                }))
              }
            />
          </div>
          <div>
            <Label>Default Contact</Label>
            <Input
              className="mt-1"
              value={state.defaultContact || ''}
              onChange={(e) =>
                setState((s) => ({ ...s, defaultContact: e.target.value.trim() || undefined }))
              }
              placeholder="Must be one of the whitelisted contacts"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Per-Transaction Max (USD)</Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1"
                value={state.perTxnMax}
                onChange={(e) =>
                  setState((s) => ({ ...s, perTxnMax: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <Label>Daily Max (USD)</Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1"
                value={state.dailyMax}
                onChange={(e) =>
                  setState((s) => ({ ...s, dailyMax: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}






