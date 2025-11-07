'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatedCard } from '@/components/ui/animated-card';
import { UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getUserOrganization } from '@/lib/organization';
import { useSmoothNavigation } from '@/lib/navigation';

export default function NewEmployeePage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    wallet_address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { navigate } = useSmoothNavigation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in');
        return;
      }

      const orgData = await getUserOrganization(supabase);

      if (!orgData) {
        setError('Organization not found');
        return;
      }

      const { error: insertError } = await supabase
        .from('employees')
        .insert({
          organization_id: orgData.id,
          name: formData.name,
          email: formData.email,
          wallet_address: formData.wallet_address || null,
          status: 'active',
        });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      navigate('/dashboard/employees');
    } catch (err: any) {
      setError(err.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <Link
        href="/dashboard/employees"
        className="inline-flex items-center text-slate-300 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Employees
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Add Employee</h1>
        <p className="text-slate-300">Add a new team member to your organization</p>
      </div>

      <AnimatedCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Wallet Address (Optional)
            </label>
            <input
              type="text"
              value={formData.wallet_address}
              onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
              placeholder="0x..."
            />
            <p className="text-xs text-slate-400 mt-1">
              Ethereum wallet address for USDC payments
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              {loading ? 'Adding...' : 'Add Employee'}
            </button>
            <Link
              href="/dashboard/employees"
              className="px-6 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </AnimatedCard>
    </div>
  );
}

