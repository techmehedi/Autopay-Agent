'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatedCard } from '@/components/ui/animated-card';
import { ArrowLeft, Plus, Trash2, Edit, Save, X, Shield, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getUserOrganization } from '@/lib/organization';
import { getCustomPolicies, createCustomPolicy, updateCustomPolicy, deleteCustomPolicy, CustomPolicy } from '@/lib/customPolicies';

export default function CustomPoliciesPage() {
  const [policies, setPolicies] = useState<CustomPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<CustomPolicy | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const supabase = createClientComponentClient();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rule_type: 'amount_limit' as CustomPolicy['rule_type'],
    active: true,
    priority: 0,
    rule_config: {} as any,
  });

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      const orgData = await getUserOrganization(supabase);
      if (orgData) {
        const data = await getCustomPolicies(orgData.id);
        setPolicies(data);
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      setError('Failed to load custom policies');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const orgData = await getUserOrganization(supabase);
      if (!orgData) {
        setError('Organization not found');
        return;
      }

      // Build rule_config based on rule_type
      const rule_config = buildRuleConfig(formData.rule_type);

      if (editingPolicy) {
        const success = await updateCustomPolicy(editingPolicy.id, {
          ...formData,
          rule_config,
        });
        if (success) {
          setSuccess('Policy updated successfully!');
          setShowForm(false);
          setEditingPolicy(null);
          loadPolicies();
        } else {
          setError('Failed to update policy');
        }
      } else {
        const newPolicy = await createCustomPolicy(orgData.id, {
          ...formData,
          rule_config,
        });
        if (newPolicy) {
          setSuccess('Policy created successfully!');
          setShowForm(false);
          resetForm();
          loadPolicies();
        } else {
          setError('Failed to create policy');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  const buildRuleConfig = (ruleType: CustomPolicy['rule_type']): any => {
    switch (ruleType) {
      case 'amount_limit':
        return {
          maxAmount: formData.rule_config.maxAmount ? parseFloat(formData.rule_config.maxAmount) : undefined,
          minAmount: formData.rule_config.minAmount ? parseFloat(formData.rule_config.minAmount) : undefined,
        };
      case 'purpose_restriction':
        return {
          allowedKeywords: formData.rule_config.allowedKeywords?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
          blockedKeywords: formData.rule_config.blockedKeywords?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
        };
      case 'employee_restriction':
        return {
          allowedEmployeeIds: formData.rule_config.allowedEmployeeIds?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
          blockedEmployeeIds: formData.rule_config.blockedEmployeeIds?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
        };
      case 'time_restriction':
        return {
          allowedDays: formData.rule_config.allowedDays?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
          allowedHours: formData.rule_config.allowedHours_start && formData.rule_config.allowedHours_end
            ? { start: formData.rule_config.allowedHours_start, end: formData.rule_config.allowedHours_end }
            : undefined,
        };
      case 'category_restriction':
        return {
          allowedCategories: formData.rule_config.allowedCategories?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
          blockedCategories: formData.rule_config.blockedCategories?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
        };
      case 'custom_condition':
        return {
          condition: formData.rule_config.condition || '',
        };
      default:
        return {};
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      rule_type: 'amount_limit',
      active: true,
      priority: 0,
      rule_config: {},
    });
  };

  const handleEdit = (policy: CustomPolicy) => {
    setEditingPolicy(policy);
    const config = policy.rule_config as any;
    setFormData({
      name: policy.name,
      description: policy.description || '',
      rule_type: policy.rule_type,
      active: policy.active,
      priority: policy.priority,
      rule_config: {
        ...config,
        allowedKeywords: config.allowedKeywords?.join(', ') || '',
        blockedKeywords: config.blockedKeywords?.join(', ') || '',
        allowedEmployeeIds: config.allowedEmployeeIds?.join(', ') || '',
        blockedEmployeeIds: config.blockedEmployeeIds?.join(', ') || '',
        allowedDays: config.allowedDays?.join(', ') || '',
        allowedCategories: config.allowedCategories?.join(', ') || '',
        blockedCategories: config.blockedCategories?.join(', ') || '',
        allowedHours_start: config.allowedHours?.start || '',
        allowedHours_end: config.allowedHours?.end || '',
        maxAmount: config.maxAmount?.toString() || '',
        minAmount: config.minAmount?.toString() || '',
        condition: config.condition || '',
      },
    });
    setShowForm(true);
  };

  const handleDelete = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;

    try {
      const success = await deleteCustomPolicy(policyId);
      if (success) {
        setSuccess('Policy deleted successfully!');
        loadPolicies();
      } else {
        setError('Failed to delete policy');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete policy');
    }
  };

  const ruleTypeLabels = {
    amount_limit: 'Amount Limit',
    purpose_restriction: 'Purpose Restriction',
    employee_restriction: 'Employee Restriction',
    time_restriction: 'Time Restriction',
    category_restriction: 'Category Restriction',
    custom_condition: 'Custom Condition',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">Custom Policies</h1>
          <p className="text-slate-300">Create custom rules that the AI agent will check when processing claims</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-400">
          {success}
        </div>
      )}

      {!showForm && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              resetForm();
              setEditingPolicy(null);
              setShowForm(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Custom Policy
          </button>
        </div>
      )}

      {showForm && (
        <AnimatedCard>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              {editingPolicy ? 'Edit Policy' : 'Create Custom Policy'}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingPolicy(null);
                resetForm();
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Policy Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Maximum Lunch Expense"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={2}
                placeholder="Optional description of what this policy does"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rule Type *
              </label>
              <select
                required
                value={formData.rule_type}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    rule_type: e.target.value as CustomPolicy['rule_type'],
                    rule_config: {},
                  });
                }}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {Object.entries(ruleTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic form fields based on rule type */}
            {formData.rule_type === 'amount_limit' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Maximum Amount (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.rule_config.maxAmount || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      rule_config: { ...formData.rule_config, maxAmount: e.target.value },
                    })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., 50.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Minimum Amount (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.rule_config.minAmount || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      rule_config: { ...formData.rule_config, minAmount: e.target.value },
                    })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., 5.00"
                  />
                </div>
              </div>
            )}

            {formData.rule_type === 'purpose_restriction' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Allowed Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.rule_config.allowedKeywords || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      rule_config: { ...formData.rule_config, allowedKeywords: e.target.value },
                    })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., lunch, dinner, travel"
                  />
                  <p className="text-xs text-slate-400 mt-1">Purpose must contain at least one of these keywords</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Blocked Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.rule_config.blockedKeywords || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      rule_config: { ...formData.rule_config, blockedKeywords: e.target.value },
                    })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., alcohol, gambling"
                  />
                  <p className="text-xs text-slate-400 mt-1">Purpose must not contain any of these keywords</p>
                </div>
              </div>
            )}

            {formData.rule_type === 'time_restriction' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Allowed Days (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.rule_config.allowedDays || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      rule_config: { ...formData.rule_config, allowedDays: e.target.value },
                    })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., monday, tuesday, wednesday"
                  />
                  <p className="text-xs text-slate-400 mt-1">Days of the week when claims are allowed</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Start Time (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={formData.rule_config.allowedHours_start || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        rule_config: { ...formData.rule_config, allowedHours_start: e.target.value },
                      })}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      End Time (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={formData.rule_config.allowedHours_end || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        rule_config: { ...formData.rule_config, allowedHours_end: e.target.value },
                      })}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.rule_type === 'custom_condition' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Condition Description *
                </label>
                <textarea
                  required
                  value={formData.rule_config.condition || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    rule_config: { ...formData.rule_config, condition: e.target.value },
                  })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={4}
                  placeholder="Describe the condition in natural language. The AI agent will evaluate this when processing claims."
                />
                <p className="text-xs text-slate-400 mt-1">The AI will interpret and enforce this condition</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Priority
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-slate-400 mt-1">Higher priority policies are checked first</p>
              </div>
              <div className="flex items-end">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-slate-300">Active</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingPolicy(null);
                  resetForm();
                }}
                className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Save className="h-5 w-5 mr-2" />
                {editingPolicy ? 'Update Policy' : 'Create Policy'}
              </button>
            </div>
          </form>
        </AnimatedCard>
      )}

      <div className="space-y-4">
        {policies.length === 0 ? (
          <AnimatedCard>
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No custom policies yet. Create one to get started.</p>
            </div>
          </AnimatedCard>
        ) : (
          policies.map((policy) => (
            <AnimatedCard key={policy.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{policy.name}</h3>
                    {!policy.active && (
                      <span className="px-2 py-1 text-xs bg-slate-500/20 text-slate-400 rounded">Inactive</span>
                    )}
                    <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded">
                      {ruleTypeLabels[policy.rule_type]}
                    </span>
                  </div>
                  {policy.description && (
                    <p className="text-slate-400 text-sm mb-3">{policy.description}</p>
                  )}
                  <div className="text-xs text-slate-500">
                    Priority: {policy.priority} • Created: {new Date(policy.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(policy)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4 text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(policy.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              </div>
            </AnimatedCard>
          ))
        )}
      </div>
    </div>
  );
}

