'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatedCard } from '@/components/ui/animated-card';
import { FileText, Plus, DollarSign, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { getCurrentOrganization, getUserAccountType } from '@/lib/auth';

export default function ClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<'admin' | 'employee' | null>(null);
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadClaims();
    
    // Refresh claims every 5 seconds to show updated statuses
    const interval = setInterval(() => {
      loadClaims();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadClaims = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const type = await getUserAccountType();
      setAccountType(type);

      // Redirect employees to employee dashboard
      if (type === 'employee') {
        window.location.href = '/dashboard/employee';
        return;
      }

      const orgData = await getCurrentOrganization();

      if (orgData) {
        const { data, error } = await supabase
          .from('claims')
          .select('*, employees(*)')
          .eq('organization_id', orgData.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setClaims(data);
        }
      }
    } catch (error) {
      console.error('Error loading claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Claims</h1>
          <p className="text-slate-300">View and manage expense claims</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadClaims}
            className="inline-flex items-center px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors border border-white/10"
            title="Refresh claims"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <Link
            href="/dashboard/claims/new"
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Claim
          </Link>
        </div>
      </div>

      {claims.length === 0 ? (
        <AnimatedCard>
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Claims Yet</h3>
            <p className="text-slate-300 mb-6">
              Submit your first expense claim to get started.
            </p>
            <Link
              href="/dashboard/claims/new"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Submit Claim
            </Link>
          </div>
        </AnimatedCard>
      ) : (
        <AnimatedCard>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium"></th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Employee</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Purpose</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Reason</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Transaction</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => {
                  const hasExplanations = claim.explanations && Array.isArray(claim.explanations) && claim.explanations.length > 0;
                  const isExpanded = expandedClaim === claim.id;
                  
                  return (
                    <>
                      <tr
                        key={claim.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-4 px-4">
                          {hasExplanations && (
                            <button
                              onClick={() => setExpandedClaim(isExpanded ? null : claim.id)}
                              className="text-purple-400 hover:text-purple-300 transition-colors"
                              title="View detailed explanations"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-white font-medium">
                            {claim.employees?.name || 'Unknown'}
                          </div>
                          <div className="text-slate-400 text-sm">
                            {claim.employees?.email || ''}
                          </div>
                        </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center text-white font-semibold">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {Number(claim.amount).toFixed(2)}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-white">{claim.purpose}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(claim.status)}
                        <span
                          className={`text-sm font-medium ${
                            claim.status === 'approved' || claim.status === 'paid'
                              ? 'text-green-400'
                              : claim.status === 'rejected'
                              ? 'text-red-400'
                              : 'text-yellow-400'
                          }`}
                        >
                          {claim.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-slate-300 text-sm max-w-xs">
                        {claim.reason ? (
                          <span className="line-clamp-2" title={claim.reason}>
                            {claim.reason}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-300 text-sm">
                      {format(new Date(claim.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="py-4 px-4">
                      {claim.tx_id ? (
                        <span 
                          className="font-mono text-xs text-purple-400 truncate max-w-[200px] block cursor-pointer hover:text-purple-300"
                          title={claim.tx_id}
                          onClick={() => {
                            navigator.clipboard.writeText(claim.tx_id);
                          }}
                        >
                          {claim.tx_id}
                        </span>
                      ) : claim.status === 'approved' ? (
                        <span className="text-slate-400 text-xs">Processing...</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {claim.confidence ? (
                        <span className="text-slate-300 text-sm">
                          {(claim.confidence * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                      </tr>
                      {isExpanded && hasExplanations && (
                        <tr key={`${claim.id}-details`} className="bg-white/5">
                          <td colSpan={9} className="py-4 px-4">
                            <div className="pl-8 border-l-2 border-purple-500/30">
                              <h4 className="text-sm font-semibold text-purple-300 mb-2">Detailed Explanations:</h4>
                              <ul className="space-y-2">
                                {claim.explanations.map((exp: any, idx: number) => (
                                  <li key={idx} className="text-sm text-slate-300">
                                    <span className="font-medium text-purple-400">
                                      {exp.label || `Rule ${idx + 1}`}:
                                    </span>{' '}
                                    {exp.reason}
                                    {exp.weight !== undefined && (
                                      <span className="ml-2 text-xs text-slate-500">
                                        (weight: {exp.weight > 0 ? '+' : ''}{exp.weight.toFixed(2)})
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AnimatedCard>
      )}
    </div>
  );
}

