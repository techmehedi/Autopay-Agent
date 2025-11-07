'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatedCard } from '@/components/ui/animated-card';
import { Save, Link as LinkIcon, Building2, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUserOrganization } from '@/lib/organization';

export default function SettingsPage() {
  const [organization, setOrganization] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    locus_client_id: '',
    locus_client_secret: '',
    locus_mcp_url: 'https://mcp.paywithlocus.com/mcp',
    per_txn_max: '0.50',
    daily_max: '3.00',
    monthly_max: '',
    default_contact: '',
    auto_approve: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/signin');
        return;
      }

      const orgData = await getUserOrganization(supabase);

      if (orgData) {
        setOrganization(orgData);
        setFormData({
          name: orgData.name || '',
          locus_client_id: orgData.locus_client_id || '',
          locus_client_secret: orgData.locus_client_secret || '',
          locus_mcp_url: orgData.locus_mcp_url || 'https://mcp.paywithlocus.com/mcp',
          per_txn_max: '',
          daily_max: '',
          monthly_max: '',
          default_contact: '',
          auto_approve: false,
        });

        const { data: policyData } = await supabase
          .from('policies')
          .select('*')
          .eq('organization_id', orgData.id)
          .single();

        if (policyData) {
          setPolicy(policyData);
          setFormData((prev) => ({
            ...prev,
            per_txn_max: policyData.per_txn_max?.toString() || '0.50',
            daily_max: policyData.daily_max?.toString() || '3.00',
            monthly_max: policyData.monthly_max?.toString() || '',
            default_contact: policyData.default_contact || '',
            auto_approve: policyData.auto_approve || false,
          }));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!organization) {
        setError('Organization not found');
        return;
      }

      // Update organization
      const { error: orgError } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          locus_client_id: formData.locus_client_id || null,
          locus_client_secret: formData.locus_client_secret || null,
          locus_mcp_url: formData.locus_mcp_url || null,
        })
        .eq('id', organization.id);

      if (orgError) throw orgError;

      // Update or create policy
      const policyData = {
        organization_id: organization.id,
        per_txn_max: parseFloat(formData.per_txn_max),
        daily_max: parseFloat(formData.daily_max),
        monthly_max: formData.monthly_max ? parseFloat(formData.monthly_max) : null,
        default_contact: formData.default_contact || null,
        auto_approve: formData.auto_approve,
      };

      if (policy) {
        const { error: policyError } = await supabase
          .from('policies')
          .update(policyData)
          .eq('id', policy.id);

        if (policyError) throw policyError;
      } else {
        const { error: policyError } = await supabase
          .from('policies')
          .insert(policyData);

        if (policyError) throw policyError;
      }

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <AnimatedCard>
        <div className="text-center py-12">
          <p className="text-slate-300">No organization found. Please create one first.</p>
        </div>
      </AnimatedCard>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-300">Configure your organization and payment settings</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Organization Settings */}
        <AnimatedCard>
          <div className="flex items-center space-x-3 mb-6">
            <Building2 className="h-6 w-6 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Organization</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Organization Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {organization.join_code && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Employee Join Code
              </label>
              <div className="flex items-center gap-3">
                <code className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm">
                  {organization.join_code}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(organization.join_code);
                    setSuccess('Join code copied to clipboard!');
                    setTimeout(() => setSuccess(''), 2000);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Share this code with employees so they can join your organization
              </p>
            </div>
          )}
        </AnimatedCard>

        {/* Locus Integration */}
        <AnimatedCard>
          <div className="flex items-center space-x-3 mb-6">
            <LinkIcon className="h-6 w-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Locus Payment Integration</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Client ID
              </label>
              <input
                type="text"
                value={formData.locus_client_id}
                onChange={(e) => setFormData({ ...formData, locus_client_id: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your Locus Client ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Client Secret
              </label>
              <input
                type="password"
                value={formData.locus_client_secret}
                onChange={(e) => setFormData({ ...formData, locus_client_secret: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your Locus Client Secret"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                MCP URL
              </label>
              <input
                type="url"
                value={formData.locus_mcp_url}
                onChange={(e) => setFormData({ ...formData, locus_mcp_url: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://mcp.paywithlocus.com/mcp"
              />
            </div>
          </div>
        </AnimatedCard>

        {/* Policy Settings */}
        <AnimatedCard>
          <div className="flex items-center space-x-3 mb-6">
            <Shield className="h-6 w-6 text-green-400" />
            <h2 className="text-xl font-semibold text-white">Policy Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Per Transaction Max (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.per_txn_max}
                onChange={(e) => setFormData({ ...formData, per_txn_max: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Daily Max (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.daily_max}
                onChange={(e) => setFormData({ ...formData, daily_max: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Monthly Max (USD) - Optional
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.monthly_max}
                onChange={(e) => setFormData({ ...formData, monthly_max: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Default Contact (Email or Wallet)
              </label>
              <input
                type="text"
                value={formData.default_contact}
                onChange={(e) => setFormData({ ...formData, default_contact: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="user@example.com or 0x..."
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.auto_approve}
                onChange={(e) => setFormData({ ...formData, auto_approve: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-slate-300">Auto-approve claims within limits</span>
            </label>
          </div>
        </AnimatedCard>

        {/* Custom Policies */}
        <AnimatedCard>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Custom Policies</h2>
            </div>
            <Link
              href="/dashboard/settings/custom-policies"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              Manage Custom Policies
            </Link>
          </div>
          <p className="text-slate-400 text-sm">
            Create custom rules that the AI agent will check when processing claims. These are in addition to the standard policy limits above.
          </p>
        </AnimatedCard>

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

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

