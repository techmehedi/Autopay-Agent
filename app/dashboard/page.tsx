'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatedCard } from '@/components/ui/animated-card';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  Users, 
  FileCheck, 
  TrendingUp,
  Zap,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { getUserAccountType, getCurrentOrganization } from '@/lib/auth';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalClaims: 0,
    totalAmount: 0,
    totalEmployees: 0,
    pendingClaims: 0,
  });
  const [recentClaims, setRecentClaims] = useState<any[]>([]);
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Check account type and redirect employees to employee dashboard
      const accountType = await getUserAccountType();
      if (accountType === 'employee') {
        window.location.href = '/dashboard/employee';
        return;
      }

      // Get user's organization (for admins)
      const orgData = await getCurrentOrganization();

      if (orgData) {
        setOrganization(orgData);

        // Get stats
        const { data: claims } = await supabase
          .from('claims')
          .select('*')
          .eq('organization_id', orgData.id);

        const { data: employees } = await supabase
          .from('employees')
          .select('*')
          .eq('organization_id', orgData.id)
          .eq('status', 'active');

        const totalAmount = claims?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
        const pendingClaims = claims?.filter((c) => c.status === 'pending').length || 0;

        setStats({
          totalClaims: claims?.length || 0,
          totalAmount,
          totalEmployees: employees?.length || 0,
          pendingClaims,
        });

        // Get recent claims
        const { data: recent } = await supabase
          .from('claims')
          .select('*, employees(*)')
          .eq('organization_id', orgData.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentClaims(recent || []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
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
          <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Organization Found</h3>
          <p className="text-slate-300 mb-6">
            You need to create an organization to get started.
          </p>
          <Link
            href="/dashboard/create-org"
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create Organization
          </Link>
        </div>
      </AnimatedCard>
    );
  }

  const statCards = [
    {
      title: 'Total Claims',
      value: stats.totalClaims,
      icon: FileCheck,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Total Amount',
      value: `$${stats.totalAmount.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Employees',
      value: stats.totalEmployees,
      icon: Users,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Pending',
      value: stats.pendingClaims,
      icon: TrendingUp,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome to {organization.name}
        </h1>
        <p className="text-slate-300">
          Manage employee reimbursements with AI-powered automation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <AnimatedCard key={stat.title} delay={index * 0.1}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </AnimatedCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatedCard delay={0.4}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Claims</h2>
            <Link
              href="/dashboard/claims"
              className="text-sm text-purple-400 hover:text-purple-300 focus:outline-none focus:ring-0 transition-colors"
            >
              View all
            </Link>
          </div>
          {recentClaims.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No claims yet</p>
          ) : (
            <div className="space-y-3">
              {recentClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/8 transition-[background-color] duration-200"
                >
                  <div>
                    <p className="text-white font-medium">
                      ${Number(claim.amount).toFixed(2)}
                    </p>
                    <p className="text-slate-400 text-sm">{claim.purpose}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {format(new Date(claim.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      claim.status === 'approved' || claim.status === 'paid'
                        ? 'bg-green-500/20 text-green-400'
                        : claim.status === 'rejected'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {claim.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </AnimatedCard>

        <AnimatedCard delay={0.5}>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white mb-2">Quick Actions</h2>
          </div>
          <div className="space-y-3">
            <Link
              href="/dashboard/employees/new"
              className="flex items-center p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-[background-color] duration-200 focus:outline-none focus:ring-0"
            >
              <Users className="h-5 w-5 text-purple-400 mr-3" />
              <div>
                <p className="text-white font-medium">Add Employee</p>
                <p className="text-slate-400 text-sm">Invite team members</p>
              </div>
            </Link>
            <Link
              href="/dashboard/claims/new"
              className="flex items-center p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-[background-color] duration-200 focus:outline-none focus:ring-0"
            >
              <FileCheck className="h-5 w-5 text-blue-400 mr-3" />
              <div>
                <p className="text-white font-medium">Submit Claim</p>
                <p className="text-slate-400 text-sm">Request reimbursement</p>
              </div>
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-[background-color] duration-200 focus:outline-none focus:ring-0"
            >
              <Zap className="h-5 w-5 text-yellow-400 mr-3" />
              <div>
                <p className="text-white font-medium">Connect Locus</p>
                <p className="text-slate-400 text-sm">Set up payments</p>
              </div>
            </Link>
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}

