import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface CustomPolicyRuleConfig {
  // For amount_limit
  maxAmount?: number;
  minAmount?: number;
  
  // For category_restriction
  allowedCategories?: string[];
  blockedCategories?: string[];
  
  // For time_restriction
  allowedDays?: string[]; // ['monday', 'tuesday', etc.]
  allowedHours?: { start: string; end: string }; // e.g., { start: '09:00', end: '17:00' }
  
  // For employee_restriction
  allowedEmployeeIds?: string[];
  blockedEmployeeIds?: string[];
  
  // For purpose_restriction
  allowedKeywords?: string[];
  blockedKeywords?: string[];
  
  // For custom_condition
  condition?: string; // Natural language description
}

export interface CustomPolicy {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  rule_type: 'amount_limit' | 'category_restriction' | 'time_restriction' | 'employee_restriction' | 'purpose_restriction' | 'custom_condition';
  rule_config: CustomPolicyRuleConfig;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export async function getCustomPolicies(organizationId: string, supabaseClient?: ReturnType<typeof createClientComponentClient>): Promise<CustomPolicy[]> {
  const supabase = supabaseClient || createClientComponentClient();
  const { data, error } = await supabase
    .from('custom_policies')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('active', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((p: any) => ({
    ...p,
    rule_config: typeof p.rule_config === 'string' ? JSON.parse(p.rule_config) : (p.rule_config || {}),
  }));
}

export async function createCustomPolicy(
  organizationId: string,
  policy: Omit<CustomPolicy, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<CustomPolicy | null> {
  const supabase = createClientComponentClient();
  const { data, error } = await supabase
    .from('custom_policies')
    .insert({
      organization_id: organizationId,
      ...policy,
      rule_config: typeof policy.rule_config === 'object' ? policy.rule_config : JSON.parse(policy.rule_config as any),
    })
    .select()
    .single();

  if (error || !data) return null;
  return {
    ...data,
    rule_config: typeof data.rule_config === 'string' ? JSON.parse(data.rule_config) : data.rule_config,
  };
}

export async function updateCustomPolicy(
  policyId: string,
  updates: Partial<Omit<CustomPolicy, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
  const supabase = createClientComponentClient();
  const updateData: any = { ...updates };
  if (updateData.rule_config && typeof updateData.rule_config === 'object') {
    updateData.rule_config = updateData.rule_config;
  }

  const { error } = await supabase
    .from('custom_policies')
    .update(updateData)
    .eq('id', policyId);

  return !error;
}

export async function deleteCustomPolicy(policyId: string): Promise<boolean> {
  const supabase = createClientComponentClient();
  const { error } = await supabase
    .from('custom_policies')
    .delete()
    .eq('id', policyId);

  return !error;
}

/**
 * Evaluate custom policies against claim data
 */
export async function evaluateCustomPolicies(
  organizationId: string,
  claimData: {
    amount: number;
    purpose?: string;
    employeeId?: string;
    category?: string;
  }
): Promise<{ passed: boolean; failedPolicies: CustomPolicy[]; reasons: string[] }> {
  const policies = await getCustomPolicies(organizationId);
  const failedPolicies: CustomPolicy[] = [];
  const reasons: string[] = [];

  for (const policy of policies) {
    let passed = true;
    let reason = '';

    switch (policy.rule_type) {
      case 'amount_limit':
        if (policy.rule_config.maxAmount !== undefined && claimData.amount > policy.rule_config.maxAmount) {
          passed = false;
          reason = `Amount $${claimData.amount.toFixed(2)} exceeds maximum of $${policy.rule_config.maxAmount.toFixed(2)} (Policy: ${policy.name})`;
        }
        if (policy.rule_config.minAmount !== undefined && claimData.amount < policy.rule_config.minAmount) {
          passed = false;
          reason = `Amount $${claimData.amount.toFixed(2)} is below minimum of $${policy.rule_config.minAmount.toFixed(2)} (Policy: ${policy.name})`;
        }
        break;

      case 'purpose_restriction':
        if (claimData.purpose) {
          const purposeLower = claimData.purpose.toLowerCase();
          
          // Check blocked keywords
          if (policy.rule_config.blockedKeywords) {
            for (const keyword of policy.rule_config.blockedKeywords) {
              if (purposeLower.includes(keyword.toLowerCase())) {
                passed = false;
                reason = `Purpose contains blocked keyword "${keyword}" (Policy: ${policy.name})`;
                break;
              }
            }
          }
          
          // Check allowed keywords (if specified, purpose must contain at least one)
          if (passed && policy.rule_config.allowedKeywords && policy.rule_config.allowedKeywords.length > 0) {
            const hasAllowedKeyword = policy.rule_config.allowedKeywords.some(keyword =>
              purposeLower.includes(keyword.toLowerCase())
            );
            if (!hasAllowedKeyword) {
              passed = false;
              reason = `Purpose must contain one of: ${policy.rule_config.allowedKeywords.join(', ')} (Policy: ${policy.name})`;
            }
          }
        }
        break;

      case 'employee_restriction':
        if (claimData.employeeId) {
          if (policy.rule_config.blockedEmployeeIds?.includes(claimData.employeeId)) {
            passed = false;
            reason = `Employee is blocked by policy (Policy: ${policy.name})`;
          }
          if (policy.rule_config.allowedEmployeeIds && policy.rule_config.allowedEmployeeIds.length > 0) {
            if (!policy.rule_config.allowedEmployeeIds.includes(claimData.employeeId)) {
              passed = false;
              reason = `Employee is not in allowed list (Policy: ${policy.name})`;
            }
          }
        }
        break;

      case 'time_restriction':
        const now = new Date();
        const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        if (policy.rule_config.allowedDays && !policy.rule_config.allowedDays.includes(dayName)) {
          passed = false;
          reason = `Claims are only allowed on: ${policy.rule_config.allowedDays.join(', ')} (Policy: ${policy.name})`;
        }
        
        if (passed && policy.rule_config.allowedHours) {
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTime = currentHour * 60 + currentMinute;
          
          const [startHour, startMin] = policy.rule_config.allowedHours.start.split(':').map(Number);
          const [endHour, endMin] = policy.rule_config.allowedHours.end.split(':').map(Number);
          const startTime = startHour * 60 + startMin;
          const endTime = endHour * 60 + endMin;
          
          if (currentTime < startTime || currentTime > endTime) {
            passed = false;
            reason = `Claims are only allowed between ${policy.rule_config.allowedHours.start} and ${policy.rule_config.allowedHours.end} (Policy: ${policy.name})`;
          }
        }
        break;

      case 'category_restriction':
        if (claimData.category) {
          if (policy.rule_config.blockedCategories?.includes(claimData.category)) {
            passed = false;
            reason = `Category "${claimData.category}" is blocked (Policy: ${policy.name})`;
          }
          if (policy.rule_config.allowedCategories && policy.rule_config.allowedCategories.length > 0) {
            if (!policy.rule_config.allowedCategories.includes(claimData.category)) {
              passed = false;
              reason = `Category must be one of: ${policy.rule_config.allowedCategories.join(', ')} (Policy: ${policy.name})`;
            }
          }
        }
        break;

      case 'custom_condition':
        // For custom conditions, we'll include them in the agent prompt
        // The agent will evaluate them based on the description
        // This is a pass-through for the agent to handle
        break;
    }

    if (!passed) {
      failedPolicies.push(policy);
      reasons.push(reason);
    }
  }

  return {
    passed: failedPolicies.length === 0,
    failedPolicies,
    reasons,
  };
}

