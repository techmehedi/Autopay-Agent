'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatedCard } from '@/components/ui/animated-card';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  FileCheck, 
  Wallet,
  Plus,
  Building2,
  Copy,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { getCurrentOrganization, getUserAccountType } from '@/lib/auth';

export default function EmployeeDashboardPage() {
  const [organization, setOrganization] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [employee, setEmployee] = useState<any>(null);
  const [myClaims, setMyClaims] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalClaims: 0,
    totalAmount: 0,
    approvedClaims: 0,
  });
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
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

      const accountType = await getUserAccountType();
      if (accountType !== 'employee') {
        // Redirect to admin dashboard if not employee
        window.location.href = '/dashboard';
        return;
      }

      // Get all organizations the employee is part of
      // First get employee_organizations, then fetch org details separately
      const { data: employeeOrgs, error: empOrgsError } = await supabase
        .from('employee_organizations')
        .select('organization_id, status')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (empOrgsError) {
        console.error('Error fetching employee organizations:', empOrgsError);
      }

      // Fetch organization details for each org
      let orgsList: any[] = [];
      if (employeeOrgs && employeeOrgs.length > 0) {
        const orgIds = employeeOrgs.map((eo: any) => eo.organization_id);
        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name, join_code')
          .in('id', orgIds);

        if (orgsError) {
          console.error('Error fetching organizations:', orgsError);
        } else if (orgsData) {
          orgsList = orgsData;
        }
      }

      let currentOrg: any = null;
      
      if (orgsList.length > 0) {
        setOrganizations(orgsList);

        // Get current organization (first one or previously selected)
        const orgData = await getCurrentOrganization();
        currentOrg = orgData || orgsList[0];
        setOrganization(currentOrg);
      } else {
        // Try to get current organization even if no employee_organizations exist yet
        const orgData = await getCurrentOrganization();
        currentOrg = orgData;
        setOrganization(orgData);
      }

      // Get organization for claims/stats
      if (currentOrg) {
        // Get employee record
        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .eq('user_id', user.id)
          .eq('organization_id', currentOrg.id)
          .single();

        setEmployee(empData);

        // Get my claims
        if (empData) {
          const { data: claims } = await supabase
            .from('claims')
            .select('*')
            .eq('employee_id', empData.id)
            .order('created_at', { ascending: false })
            .limit(10);

          setMyClaims(claims || []);

          const totalAmount = claims?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
          const approvedClaims = claims?.filter((c) => c.status === 'approved' || c.status === 'paid').length || 0;

          setStats({
            totalClaims: claims?.length || 0,
            totalAmount,
            approvedClaims,
          });
        }
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrganization = async () => {
    if (!joinCode.trim()) {
      setJoinError('Please enter a join code');
      return;
    }

    setJoining(true);
    setJoinError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setJoinError('You must be logged in');
        return;
      }

      // Find organization by join code using RPC function (bypasses RLS)
      const { data: orgDataRpc, error: rpcError } = await supabase
        .rpc('get_org_by_join_code', { join_code_to_check: joinCode.trim().toUpperCase() });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        setJoinError('Invalid join code. Please check and try again.');
        return;
      }

      if (!orgDataRpc || orgDataRpc.length === 0) {
        setJoinError('Invalid join code. Please check and try again.');
        return;
      }

      // Use the org data from RPC (we only need id, name, join_code)
      const orgData = {
        id: orgDataRpc[0].id,
        name: orgDataRpc[0].name,
        join_code: orgDataRpc[0].join_code,
      };

      // Check if already a member (check both active and pending)
      const { data: existing, error: existingError } = await supabase
        .from('employee_organizations')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', orgData.id)
        .maybeSingle();

      if (existing && !existingError) {
        // If already a member, refresh the dashboard to show the org
        if (existing.status === 'active') {
          setJoinError('You are already a member of this organization. Refreshing...');
          setTimeout(async () => {
            await loadDashboardData();
            setJoinError('');
          }, 1000);
        } else {
          setJoinError('You have a pending request to join this organization');
        }
        return;
      }

      // Create or get employee record
      let employeeId: string;
      const { data: existingEmployee } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', orgData.id)
        .single();

      if (existingEmployee) {
        employeeId = existingEmployee.id;
      } else {
        // Create employee record
        const { data: newEmployee, error: empError } = await supabase
          .from('employees')
          .insert({
            organization_id: orgData.id,
            user_id: user.id,
            email: user.email || '',
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Employee',
          })
          .select()
          .single();

        if (empError || !newEmployee) {
          setJoinError('Failed to create employee record. Please try again.');
          return;
        }

        employeeId = newEmployee.id;
      }

      // Add to employee_organizations
      const { error: joinError } = await supabase
        .from('employee_organizations')
        .insert({
          user_id: user.id,
          organization_id: orgData.id,
          employee_id: employeeId,
          status: 'active',
        });

      if (joinError) {
        setJoinError('Failed to join organization. Please try again.');
        return;
      }

      // Success - reload dashboard
      setJoinCode('');
      await loadDashboardData();
    } catch (error: any) {
      setJoinError(error.message || 'An error occurred. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleSwitchOrganization = async (orgId: string) => {
    // Find the selected organization
    const selectedOrg = organizations.find((org: any) => org.id === orgId);
    if (!selectedOrg) return;

    // Update current organization
    setOrganization(selectedOrg);

    // Reload claims/stats for this organization
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', selectedOrg.id)
        .single();

      setEmployee(empData);

      if (empData) {
        const { data: claims } = await supabase
          .from('claims')
          .select('*')
          .eq('employee_id', empData.id)
          .order('created_at', { ascending: false })
          .limit(10);

        setMyClaims(claims || []);

        const totalAmount = claims?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
        const approvedClaims = claims?.filter((c) => c.status === 'approved' || c.status === 'paid').length || 0;

        setStats({
          totalClaims: claims?.length || 0,
          totalAmount,
          approvedClaims,
        });
      }
    }
  };

  const copyWalletAddress = () => {
    if (employee?.wallet_address) {
      navigator.clipboard.writeText(employee.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      <div className="space-y-8 max-w-2xl mx-auto">
        <AnimatedCard>
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Join an Organization</h3>
            <p className="text-slate-300 mb-6">
              Enter the organization join code provided by your administrator to get started.
            </p>
            
            <div className="max-w-md mx-auto space-y-4">
              <div>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter join code"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center text-lg font-mono tracking-wider"
                  maxLength={8}
                />
              </div>
              
              {joinError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                  {joinError}
                </div>
              )}
              
              <button
                onClick={handleJoinOrganization}
                disabled={joining || !joinCode.trim()}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joining ? 'Joining...' : 'Join Organization'}
              </button>
            </div>
          </div>
        </AnimatedCard>
      </div>
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
      title: 'Approved',
      value: stats.approvedClaims,
      icon: Check,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          {organization ? `Welcome to ${organization.name}` : 'Employee Dashboard'}
        </h1>
        <p className="text-slate-300">
          Submit reimbursement claims and track your expenses
        </p>
      </div>

      {/* Organizations List */}
      {organizations.length > 0 && (
        <AnimatedCard delay={0.1}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              My Organizations
            </h2>
          </div>
          <div className="space-y-3">
            {organizations.map((org: any) => (
              <button
                key={org.id}
                onClick={() => handleSwitchOrganization(org.id)}
                className={`w-full p-4 rounded-lg border transition-colors text-left ${
                  organization?.id === org.id
                    ? 'bg-purple-500/10 border-purple-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-purple-400" />
                    <div>
                      <h3 className="text-white font-medium">{org.name}</h3>
                      {organization?.id === org.id && (
                        <p className="text-xs text-purple-400 mt-0.5">Current organization</p>
                      )}
                    </div>
                  </div>
                  {organization?.id === org.id ? (
                    <span className="px-3 py-1 text-xs font-medium bg-purple-600 text-white rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                      Switch
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </AnimatedCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <h2 className="text-xl font-semibold text-white">My Claims</h2>
            <Link
              href="/dashboard/claims/new"
              className="inline-flex items-center px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Claim
            </Link>
          </div>
          {myClaims.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">No claims yet</p>
              <Link
                href="/dashboard/claims/new"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Submit Your First Claim
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-white font-semibold">
                          ${Number(claim.amount).toFixed(2)}
                        </p>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            claim.status === 'approved' || claim.status === 'paid'
                              ? 'bg-green-500/20 text-green-400'
                              : claim.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {claim.status === 'approved' || claim.status === 'paid' ? 'Approved' : claim.status === 'rejected' ? 'Rejected' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm mb-2">{claim.purpose}</p>
                      {claim.reason && (claim.status === 'approved' || claim.status === 'rejected' || claim.status === 'paid') && (
                        <p className="text-slate-400 text-xs mt-2 italic">
                          {claim.reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs mt-2">
                    {format(new Date(claim.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </AnimatedCard>

        <AnimatedCard delay={0.5}>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white mb-2">Wallet Address</h2>
            <p className="text-slate-400 text-sm mb-4">
              Your wallet address for receiving payments
            </p>
          </div>
          
          {employee?.wallet_address ? (
            <div className="space-y-3">
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between">
                  <code className="text-sm text-white font-mono break-all">
                    {employee.wallet_address}
                  </code>
                  <button
                    onClick={copyWalletAddress}
                    className="ml-2 p-2 hover:bg-white/10 rounded transition-colors"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
              <Link
                href="/dashboard/employee/wallet"
                className="block text-center px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm text-slate-300"
              >
                Update Wallet Address
              </Link>
            </div>
          ) : (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">No wallet address set</p>
              <Link
                href="/dashboard/employee/wallet"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Add Wallet Address
              </Link>
            </div>
          )}
        </AnimatedCard>
      </div>
    </div>
  );
}

