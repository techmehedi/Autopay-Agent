'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatedCard } from '@/components/ui/animated-card';
import { motion } from 'framer-motion';
import { Users, Plus, Mail, Wallet, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { getUserOrganization } from '@/lib/organization';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const orgData = await getUserOrganization(supabase);

      if (orgData) {
        setOrganization(orgData);
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('organization_id', orgData.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setEmployees(data);
        }
      }
    } catch (error) {
      console.error('Error loading employees:', error);
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Employees</h1>
          <p className="text-slate-300">Manage your team members</p>
        </div>
        <Link
          href="/dashboard/employees/new"
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Employee
        </Link>
      </div>

      {employees.length === 0 ? (
        <AnimatedCard>
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Employees Yet</h3>
            <p className="text-slate-300 mb-6">
              Start by adding your first employee to enable reimbursements.
            </p>
            <Link
              href="/dashboard/employees/new"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Add Employee
            </Link>
          </div>
        </AnimatedCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((employee, index) => (
            <AnimatedCard key={employee.id} delay={index * 0.1}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-500/20 p-3 rounded-lg">
                    <Users className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{employee.name}</h3>
                    <p className="text-slate-400 text-sm flex items-center mt-1">
                      <Mail className="h-3 w-3 mr-1" />
                      {employee.email}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    employee.status === 'active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {employee.status}
                </span>
              </div>
              {employee.wallet_address && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-slate-400 text-sm flex items-center">
                    <Wallet className="h-3 w-3 mr-2" />
                    <span className="font-mono text-xs truncate">
                      {employee.wallet_address}
                    </span>
                  </p>
                </div>
              )}
            </AnimatedCard>
          ))}
        </div>
      )}
    </div>
  );
}

