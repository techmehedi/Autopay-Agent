'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatedCard } from '@/components/ui/animated-card';
import { ArrowLeft, Wallet, Save, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { getCurrentOrganization, getUserAccountType } from '@/lib/auth';

export default function WalletManagementPage() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletLabel, setNewWalletLabel] = useState('');
  const [addingWallet, setAddingWallet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [organization, setOrganization] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const accountType = await getUserAccountType();
      if (accountType !== 'employee') {
        router.push('/dashboard');
        return;
      }

      const orgData = await getCurrentOrganization();
      if (!orgData) {
        router.push('/dashboard/employee');
        return;
      }

      setOrganization(orgData);

      // Get employee record
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', orgData.id)
        .single();

      if (empData) {
        setEmployee(empData);

        // Load all wallets for this employee
        const { data: walletData } = await supabase
          .from('employee_wallets')
          .select('*')
          .eq('employee_id', empData.id)
          .eq('organization_id', orgData.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true });

        setWallets(walletData || []);
      }
    } catch (error) {
      console.error('Error loading wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWallet = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !employee || !organization) {
        setError('Missing required information');
        return;
      }

      // Validate wallet address format
      const address = newWalletAddress.trim();
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        setError('Invalid wallet address format. Must be a valid Ethereum address (0x followed by 40 hex characters).');
        return;
      }

      // Check if wallet already exists
      const existingWallet = wallets.find(
        (w) => w.address.toLowerCase() === address.toLowerCase()
      );
      if (existingWallet) {
        setError('This wallet address is already added');
        return;
      }

      // Add wallet to employee_wallets table
      const { error: insertError } = await supabase
        .from('employee_wallets')
        .insert({
          organization_id: organization.id,
          employee_id: employee.id,
          user_id: user.id,
          address: address,
          label: newWalletLabel.trim() || null,
          is_default: wallets.length === 0, // First wallet is default
        });

      if (insertError) {
        setError(insertError.message || 'Failed to add wallet');
        return;
      }

      setSuccess('Wallet added successfully!');
      setNewWalletAddress('');
      setNewWalletLabel('');
      setAddingWallet(false);
      await loadWallets(); // Reload wallets
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWallet = async (walletId: string) => {
    if (!confirm('Are you sure you want to delete this wallet?')) return;

    const { error } = await supabase
      .from('employee_wallets')
      .delete()
      .eq('id', walletId);

    if (error) {
      setError('Failed to delete wallet');
      return;
    }

    setSuccess('Wallet deleted successfully!');
    await loadWallets();
  };

  const handleSetDefault = async (walletId: string) => {
    if (!employee || !organization) return;

    // Set all wallets to non-default first
    const { error: updateError } = await supabase
      .from('employee_wallets')
      .update({ is_default: false })
      .eq('employee_id', employee.id)
      .eq('organization_id', organization.id);

    if (updateError) {
      setError('Failed to update wallet');
      return;
    }

    // Set selected wallet as default
    const { error: setDefaultError } = await supabase
      .from('employee_wallets')
      .update({ is_default: true })
      .eq('id', walletId);

    if (setDefaultError) {
      setError('Failed to set default wallet');
      return;
    }

    setSuccess('Default wallet updated!');
    await loadWallets();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/employee"
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">Wallet Address</h1>
          <p className="text-slate-300">Manage your wallet address for receiving payments</p>
        </div>
      </div>

      <AnimatedCard>
        <div className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-400">
              {success}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">My Wallets</h2>
            <button
              onClick={() => setAddingWallet(!addingWallet)}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Wallet
            </button>
          </div>

          {/* Existing Wallets List */}
          {wallets.length > 0 ? (
            <div className="space-y-3">
              {wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className={`p-4 rounded-lg border ${
                    wallet.is_default
                      ? 'bg-purple-500/10 border-purple-500/50'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Wallet className="h-4 w-4 text-purple-400" />
                        {wallet.label && (
                          <span className="text-white font-medium">{wallet.label}</span>
                        )}
                        {wallet.is_default && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-600 text-white rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 font-mono">{wallet.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!wallet.is_default && (
                        <button
                          onClick={() => handleSetDefault(wallet.id)}
                          className="px-3 py-1.5 text-xs bg-white/5 text-white rounded hover:bg-white/10 transition-colors"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteWallet(wallet.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-slate-500" />
              <p>No wallets added yet. Add your first wallet to receive payments.</p>
            </div>
          )}

          {/* Add Wallet Form */}
          {addingWallet && (
            <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold text-white">Add New Wallet</h3>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Wallet Address (Ethereum) *
                </label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <input
                    type="text"
                    value={newWalletAddress}
                    onChange={(e) => setNewWalletAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Label (Optional)
                </label>
                <input
                  type="text"
                  value={newWalletLabel}
                  onChange={(e) => setNewWalletLabel(e.target.value)}
                  placeholder="e.g., Main Wallet, Personal"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setAddingWallet(false);
                    setNewWalletAddress('');
                    setNewWalletLabel('');
                    setError('');
                  }}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWallet}
                  disabled={saving || !newWalletAddress.trim()}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Adding...' : 'Add Wallet'}
                </button>
              </div>
            </div>
          )}
        </div>
      </AnimatedCard>
    </div>
  );
}

