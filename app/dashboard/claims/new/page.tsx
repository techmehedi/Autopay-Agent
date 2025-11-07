'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatedCard } from '@/components/ui/animated-card';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getUserAccountType, getCurrentOrganization } from '@/lib/auth';

export default function NewClaimPage() {
  const [accountType, setAccountType] = useState<'admin' | 'employee' | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    purpose: '',
    employee_id: '',
  });
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    const loadAccountType = async () => {
      const type = await getUserAccountType();
      setAccountType(type);
    };
    loadAccountType();
  }, []);

  const loadEmployees = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const accountType = await getUserAccountType();
      setAccountType(accountType);
      if (accountType === 'employee') {
        // Load all organizations where user is active employee
        const { data: empOrgs } = await supabase
          .from('employee_organizations')
          .select('organization_id, organizations ( id, name )')
          .eq('user_id', user.id)
          .eq('status', 'active');

        const orgs = (empOrgs || [])
          .map((eo: any) => eo.organizations)
          .filter((o: any) => o);
        setOrganizations(orgs);
        const initialOrgId = orgs[0]?.id || '';
        setSelectedOrgId(initialOrgId);

        if (initialOrgId) {
          // Load employee record for selected org
          const { data: empData } = await supabase
            .from('employees')
            .select('*')
            .eq('user_id', user.id)
            .eq('organization_id', initialOrgId)
            .single();

          if (empData) {
            setEmployees([empData]);
            setFormData((prev) => ({ ...prev, employee_id: empData.id }));
            await loadWallets(empData.id, initialOrgId);
          }
        }
      } else {
        // Admin flow: use current org
        const orgData = await getCurrentOrganization();
        if (orgData) {
          const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('organization_id', orgData.id)
            .eq('status', 'active');

          if (!error && data) {
            setEmployees(data);
            if (data.length > 0) {
              setFormData((prev) => ({ ...prev, employee_id: data[0].id }));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadWallets = async (employeeId: string, organizationId: string) => {
    const { data: walletData } = await supabase
      .from('employee_wallets')
      .select('id, address, label, is_default')
      .eq('employee_id', employeeId)
      .eq('organization_id', organizationId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setWallets(walletData || []);
    if (walletData && walletData.length > 0) {
      setSelectedWalletId(walletData[0].id);
    } else {
      setSelectedWalletId('');
    }
  };

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrgId(orgId);
    // Reload employee for selected org and wallets
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: empData } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', user.id)
      .eq('organization_id', orgId)
      .single();
    if (empData) {
      setEmployees([empData]);
      setFormData((prev) => ({ ...prev, employee_id: empData.id }));
      await loadWallets(empData.id, orgId);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in');
        return;
      }

      // Organization for employee: use selectedOrgId if present, otherwise get current org
      let orgData: any = null;
      
      if (selectedOrgId) {
        // Use selected organization - fetch full org data
        const { data: org } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', selectedOrgId)
          .single();
        orgData = org;
      } else {
        // Fallback: get current organization
        orgData = await getCurrentOrganization();
      }

      if (!orgData || !orgData.id) {
        setError('Organization not found');
        return;
      }

      // Create claim in database
      const { data: claimData, error: claimError } = await supabase
        .from('claims')
        .insert({
          organization_id: (orgData as any).id,
          employee_id: formData.employee_id,
          amount: parseFloat(formData.amount),
          purpose: formData.purpose,
          status: 'pending',
        })
        .select()
        .single();

      if (claimError) {
        setError(claimError.message);
        return;
      }

      // Process claim via API
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          claim_id: claimData.id,
          organization_id: (orgData as any).id,
          employee_id: formData.employee_id,
          amount: parseFloat(formData.amount),
          purpose: formData.purpose,
          wallet_address: wallets.find((w) => w.id === selectedWalletId)?.address || undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to process claim: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.reason || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const resultData = await response.json();

      // Claim status is already updated by the API (using service role)
      // Just refresh the claim to get the updated status
      const { data: updatedClaim } = await supabase
        .from('claims')
        .select('*')
        .eq('id', claimData.id)
        .single();

      setResult(resultData);
      // Don't redirect - let user see the result and choose when to navigate
      
    } catch (err: any) {
      console.error('Claim submission error:', err);
      setError(err.message || 'Failed to submit claim. The claim may have been created but not processed. Please check your claims page.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <Link
        href="/dashboard/claims"
        className="inline-flex items-center text-slate-300 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Claims
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Submit Expense Claim</h1>
        <p className="text-slate-300">
          Submit a new expense claim for AI-powered processing
        </p>
      </div>

      <AnimatedCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Organization select for employees with multiple orgs */}
          {organizations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Organization *
              </label>
              <select
                required
                value={selectedOrgId}
                onChange={(e) => handleOrgChange(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
              {error}
            </div>
          )}

          {employees.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Employee *
              </label>
              {employees.length === 1 ? (
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                  {employees[0].name} ({employees[0].email})
                </div>
              ) : (
                <select
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-4 py-3 text-base sm:text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Amount (USD) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-3 text-base sm:text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Purpose *
            </label>
            <textarea
              required
              rows={4}
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full px-4 py-3 text-base sm:text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
              placeholder="Describe the expense (e.g., Coffee for team meeting)"
            />
          </div>

          {/* Wallet selection for employees */}
          {wallets && (selectedOrgId || employees.length === 1) && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Reimbursement Wallet
              </label>
              {wallets.length > 0 ? (
                <div className="space-y-3">
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    className="w-full px-4 py-3 text-base sm:text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label ? `${w.label} — ` : ''}{w.address}
                        {w.is_default ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400">
                    Manage your wallets in{' '}
                    <Link href="/dashboard/employee/wallet" className="text-purple-400 hover:underline">
                      My Wallet
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                  <p className="text-sm text-yellow-400 mb-2">
                    No wallets added yet. Add a wallet to receive payments.
                  </p>
                  <Link
                    href="/dashboard/employee/wallet"
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  >
                    Go to My Wallet
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center px-6 py-3 text-base sm:text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Submit Claim
                </>
              )}
            </button>
            <Link
              href="/dashboard/claims"
              className="px-6 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </AnimatedCard>

      {result && (
        <AnimatedCard delay={0.2}>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Claim Result</h2>
              <Link
                href={accountType === 'employee' ? '/dashboard/employee' : '/dashboard/claims'}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                View All Claims →
              </Link>
            </div>
            <div
              className={`p-4 rounded-lg ${
                result.status === 'approved'
                  ? 'bg-green-500/20 border border-green-500/50'
                  : 'bg-red-500/20 border border-red-500/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-semibold text-white">
                  {result.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                </span>
                {/* Only show confidence for admins */}
                {accountType === 'admin' && result.confidence && (
                  <span className="text-sm text-slate-300">
                    Confidence: {(result.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              {result.reason && (
                <p className="text-slate-300 mt-2">{result.reason}</p>
              )}
              {/* Only show transaction ID for admins */}
              {accountType === 'admin' && result.txId && (
                <div className="mt-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <p className="text-sm font-medium text-purple-300 mb-1">Transaction ID:</p>
                  <p className="text-sm text-purple-400 font-mono break-all">{result.txId}</p>
                </div>
              )}
            </div>
            {/* Only show explanations for admins */}
            {accountType === 'admin' && result.explanations && result.explanations.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Explanations:</h3>
                <ul className="space-y-1">
                  {result.explanations.map((exp: any, idx: number) => (
                    <li key={idx} className="text-sm text-slate-400">
                      • {exp.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <Link
                href={accountType === 'employee' ? '/dashboard/employee' : '/dashboard/claims'}
                className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                View All Claims
              </Link>
              <button
                onClick={() => {
                  setResult(null);
                  setFormData({
                    amount: '',
                    purpose: '',
                    employee_id: formData.employee_id, // Keep employee selected
                  });
                }}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Submit Another Claim
              </button>
            </div>
          </div>
        </AnimatedCard>
      )}
    </div>
  );
}

