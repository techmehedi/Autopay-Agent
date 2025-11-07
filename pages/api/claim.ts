import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { processClaim } from '@/lib/agent';

interface ClaimRequest {
  claim_id?: string;
  organization_id?: string;
  employee_id?: string;
  amount?: number;
  purpose?: string;
  recipient?: string;
  text?: string;
  wallet_address?: string;
}

interface ClaimResponse {
  status: 'approved' | 'rejected';
  amount: number;
  purpose: string;
  reason?: string;
  txId?: string;
  error?: string;
  decision?: 'approve' | 'deny' | 'review';
  confidence?: number;
  explanations?: Array<{ id: string; label?: string; reason: string; weight?: number }>;
  claimId?: string;
  traceId?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClaimResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'rejected',
      amount: 0,
      purpose: '',
      reason: 'Method not allowed. Use POST.',
    });
  }

  try {
    // Create Supabase client with service role for API routes
    // In production, you'd want to validate the user's session properly
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body: ClaimRequest = req.body;

    // Get organization and validate access
    if (!body.organization_id) {
      return res.status(400).json({
        status: 'rejected',
        amount: 0,
        purpose: '',
        reason: 'organization_id is required',
      });
    }

    // Get organization
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', body.organization_id)
      .single();

    if (orgError || !orgData) {
      return res.status(403).json({
        status: 'rejected',
        amount: 0,
        purpose: '',
        reason: 'Organization not found or access denied',
      });
    }

    // Get employee if provided
    let employee = null;
    if (body.employee_id) {
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('id', body.employee_id)
        .eq('organization_id', body.organization_id)
        .single();
      employee = empData;
    }

    // Get organization policy
    const { data: policyData } = await supabase
      .from('policies')
      .select('*')
      .eq('organization_id', body.organization_id)
      .single();

    // Get custom policies (using service role client)
    // Note: We need to create a client-side compatible version or use direct Supabase query
    const { data: customPoliciesData } = await supabase
      .from('custom_policies')
      .select('*')
      .eq('organization_id', body.organization_id)
      .eq('active', true)
      .order('priority', { ascending: false });
    
    const customPolicies = (customPoliciesData || []).map((p: any) => ({
      ...p,
      rule_config: typeof p.rule_config === 'string' ? JSON.parse(p.rule_config) : (p.rule_config || {}),
    }));

    // Prepare user input for agent
    let userInput: string;
    if (body.text) {
      userInput = body.text;
    } else if (body.amount !== undefined && body.purpose) {
      userInput = `Reimburse $${body.amount.toFixed(2)} for ${body.purpose}`;
      if (body.wallet_address) {
        userInput += ` to ${body.wallet_address}`;
      } else if (body.recipient) {
        userInput += ` to ${body.recipient}`;
      } else if (employee?.wallet_address) {
        userInput += ` to ${employee.wallet_address}`;
      } else if (employee?.email) {
        userInput += ` to ${employee.email}`;
      }
    } else {
      return res.status(400).json({
        status: 'rejected',
        amount: 0,
        purpose: '',
        reason: 'Missing required fields: provide either "text" or both "amount" and "purpose".',
      });
    }

    // Evaluate custom policies before processing
    // We already have customPolicies from above, so evaluate them directly
    let customPolicyCheck = { passed: true, failedPolicies: [] as any[], reasons: [] as string[] };
    if (customPolicies.length > 0) {
      // Simple evaluation logic (can be enhanced)
      for (const policy of customPolicies) {
        const config = policy.rule_config as any;
        let passed = true;
        let reason = '';

        switch (policy.rule_type) {
          case 'amount_limit':
            if (config.maxAmount !== undefined && (body.amount || 0) > config.maxAmount) {
              passed = false;
              reason = `Amount $${(body.amount || 0).toFixed(2)} exceeds maximum of $${config.maxAmount.toFixed(2)} (Policy: ${policy.name})`;
            }
            if (passed && config.minAmount !== undefined && (body.amount || 0) < config.minAmount) {
              passed = false;
              reason = `Amount $${(body.amount || 0).toFixed(2)} is below minimum of $${config.minAmount.toFixed(2)} (Policy: ${policy.name})`;
            }
            break;
          case 'purpose_restriction':
            if (body.purpose) {
              const purposeLower = body.purpose.toLowerCase();
              if (config.blockedKeywords?.length) {
                for (const keyword of config.blockedKeywords) {
                  if (purposeLower.includes(keyword.toLowerCase())) {
                    passed = false;
                    reason = `Purpose contains blocked keyword "${keyword}" (Policy: ${policy.name})`;
                    break;
                  }
                }
              }
              if (passed && config.allowedKeywords?.length) {
                const hasAllowedKeyword = config.allowedKeywords.some((keyword: string) =>
                  purposeLower.includes(keyword.toLowerCase())
                );
                if (!hasAllowedKeyword) {
                  passed = false;
                  reason = `Purpose must contain one of: ${config.allowedKeywords.join(', ')} (Policy: ${policy.name})`;
                }
              }
            }
            break;
          case 'employee_restriction':
            if (body.employee_id) {
              if (config.blockedEmployeeIds?.includes(body.employee_id)) {
                passed = false;
                reason = `Employee is blocked by policy (Policy: ${policy.name})`;
              }
              if (passed && config.allowedEmployeeIds?.length) {
                if (!config.allowedEmployeeIds.includes(body.employee_id)) {
                  passed = false;
                  reason = `Employee is not in allowed list (Policy: ${policy.name})`;
                }
              }
            }
            break;
          case 'time_restriction':
            const now = new Date();
            const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            if (config.allowedDays?.length && !config.allowedDays.includes(dayName)) {
              passed = false;
              reason = `Claims are only allowed on: ${config.allowedDays.join(', ')} (Policy: ${policy.name})`;
            }
            if (passed && config.allowedHours) {
              const currentHour = now.getHours();
              const currentMinute = now.getMinutes();
              const currentTime = currentHour * 60 + currentMinute;
              const [startHour, startMin] = config.allowedHours.start.split(':').map(Number);
              const [endHour, endMin] = config.allowedHours.end.split(':').map(Number);
              const startTime = startHour * 60 + startMin;
              const endTime = endHour * 60 + endMin;
              if (currentTime < startTime || currentTime > endTime) {
                passed = false;
                reason = `Claims are only allowed between ${config.allowedHours.start} and ${config.allowedHours.end} (Policy: ${policy.name})`;
              }
            }
            break;
        }

        if (!passed) {
          customPolicyCheck.passed = false;
          customPolicyCheck.failedPolicies.push(policy);
          customPolicyCheck.reasons.push(reason);
        }
      }
    }

    // If custom policies fail, reject immediately
    if (!customPolicyCheck.passed) {
      return res.status(200).json({
        status: 'rejected',
        amount: body.amount || 0,
        purpose: body.purpose || '',
        reason: customPolicyCheck.reasons.join('; '),
        decision: 'deny',
        confidence: 1.0,
        explanations: customPolicyCheck.failedPolicies.map((p, idx) => ({
          id: `custom-policy-${p.id}`,
          label: p.name,
          reason: customPolicyCheck.reasons[idx] || 'Policy violation',
          weight: -1.0,
        })),
      });
    }

    // Prepare agent configuration from organization settings
    const agentConfig = {
      locusClientId: orgData.locus_client_id || undefined,
      locusClientSecret: orgData.locus_client_secret || undefined,
      locusMcpUrl: orgData.locus_mcp_url || undefined,
      whitelistedContact: body.wallet_address || policyData?.default_contact || undefined,
      perTxnMax: policyData?.per_txn_max ? Number(policyData.per_txn_max) : undefined,
      dailyMax: policyData?.daily_max ? Number(policyData.daily_max) : undefined,
      customPolicies: customPolicies, // Pass custom policies to agent
    };
    
    // Process using LangChain agent with organization-specific config
    const result = await processClaim(userInput, agentConfig);

    // Ensure amount is always a number
    const normalizedResult: ClaimResponse = {
      ...result,
      amount: typeof result.amount === 'number' ? result.amount : parseFloat(String(result.amount)) || 0,
      claimId: body.claim_id,
    };

    // Update claim status in database (using service role, so no RLS issues)
    if (body.claim_id) {
      const { error: updateError } = await supabase
        .from('claims')
        .update({
          status: result.status === 'approved' ? 'approved' : 'rejected',
          decision: result.decision,
          confidence: result.confidence,
          reason: result.reason,
          tx_id: result.txId || null,
          trace_id: result.traceId || null,
          explanations: result.explanations || null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', body.claim_id);

      if (updateError) {
        console.error('Error updating claim status:', updateError);
        // Still return the result, but log the error
      }
    }

    return res.status(200).json(normalizedResult);
  } catch (error: any) {
    console.error('Error processing claim:', error);
    
    // Try to update claim status to rejected if we have a claim_id
    if (req.body.claim_id) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        );
        
        await supabase
          .from('claims')
          .update({
            status: 'rejected',
            reason: `Processing error: ${error.message}`,
            processed_at: new Date().toISOString(),
          })
          .eq('id', req.body.claim_id);
      } catch (updateError) {
        console.error('Failed to update claim status on error:', updateError);
      }
    }
    
    return res.status(500).json({
      status: 'rejected',
      amount: req.body.amount || 0,
      purpose: req.body.purpose || '',
      reason: `Internal error: ${error.message}`,
    });
  }
}
