'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { setUserAccountType, getUserAccountType } from '@/lib/auth';
import { AnimatedCard } from '@/components/ui/animated-card';
import { Building2, User, Loader2 } from 'lucide-react';

export default function SelectAccountTypePage() {
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'admin' | 'employee' | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    checkExistingAccountType();
  }, []);

  const checkExistingAccountType = async () => {
    const accountType = await getUserAccountType();
    if (accountType) {
      // User already has account type, redirect to dashboard
      router.push('/dashboard');
      return;
    }
    setLoading(false);
  };

  const handleSelectType = async (type: 'admin' | 'employee') => {
    setSelectedType(type);
    setSaving(true);

    try {
      const success = await setUserAccountType(type);
      if (success) {
        router.push('/dashboard');
      } else {
        // Check browser console for detailed error
        const errorMsg = 'Failed to save account type. Please check:\n1. The database migration has been run (005_add_account_types_and_join_codes.sql)\n2. Check browser console for details';
        alert(errorMsg);
        setSaving(false);
      }
    } catch (error: any) {
      console.error('Error setting account type:', error);
      alert(`An error occurred: ${error.message || 'Unknown error'}. Please check the browser console for details.`);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to Reimburse.me</h1>
          <p className="text-slate-300">Select your account type to continue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatedCard delay={0.1}>
            <button
              onClick={() => handleSelectType('admin')}
              disabled={saving}
              className="w-full text-left p-6 hover:bg-white/5 transition-colors rounded-lg disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-4">
                <Building2 className="h-12 w-12 text-purple-400" />
                {saving && selectedType === 'admin' && (
                  <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Admin Account</h3>
              <p className="text-slate-400 text-sm mb-4">
                Manage organizations, employees, policies, and view all claims
              </p>
              <ul className="text-slate-300 text-xs space-y-1">
                <li>• Create and manage organizations</li>
                <li>• Add/remove employees</li>
                <li>• Configure policies and settings</li>
                <li>• View all claims and analytics</li>
                <li>• Generate organization join codes</li>
              </ul>
            </button>
          </AnimatedCard>

          <AnimatedCard delay={0.2}>
            <button
              onClick={() => handleSelectType('employee')}
              disabled={saving}
              className="w-full text-left p-6 hover:bg-white/5 transition-colors rounded-lg disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-4">
                <User className="h-12 w-12 text-blue-400" />
                {saving && selectedType === 'employee' && (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Employee Account</h3>
              <p className="text-slate-400 text-sm mb-4">
                Submit reimbursement claims and manage your wallet
              </p>
              <ul className="text-slate-300 text-xs space-y-1">
                <li>• Submit expense claims</li>
                <li>• View your claim history</li>
                <li>• Manage wallet address</li>
                <li>• Join organizations with code</li>
                <li>• Track payment status</li>
              </ul>
            </button>
          </AnimatedCard>
        </div>
      </div>
    </div>
  );
}

