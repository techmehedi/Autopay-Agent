import { auditStore } from './auditStore';
import { getPolicy } from './policy';

export interface RuleResult {
  id: string;
  label: string;
  passed: boolean;
  reason?: string;
  weight?: number;
  evidencePaths?: string[];
}

export interface RuleEvaluation {
  approved: boolean;
  results: RuleResult[];
  reason?: string;
}

export async function evaluateRules(amount: number, recipient?: string): Promise<RuleEvaluation> {
  const policy = getPolicy();
  const whitelisted = new Set(policy.whitelistedContacts);

  const results: RuleResult[] = [];

  // Rule 1: Recipient is whitelisted (or not specified → default OK)
  const recipientPassed = !recipient || (!!recipient && whitelisted.has(recipient));
  results.push({
    id: 'recipient-whitelisted',
    label: 'Recipient Whitelisted',
    passed: recipientPassed,
    reason: recipientPassed ? undefined : `Recipient "${recipient}" is not whitelisted.`,
    weight: recipientPassed ? 0.2 : -1.0,
    evidencePaths: ['recipient'],
  });

  // Rule 2: Per-transaction limit
  const perTxnPassed = amount <= policy.perTxnMax;
  results.push({
    id: 'per-transaction-limit',
    label: 'Per-Transaction Limit',
    passed: perTxnPassed,
    reason: perTxnPassed ? undefined : `Amount $${amount.toFixed(2)} exceeds per-transaction maximum of $${policy.perTxnMax.toFixed(2)}.`,
    weight: perTxnPassed ? 0.4 : -0.6,
    evidencePaths: ['amount'],
  });

  // Rule 3: Daily total limit
  const today = new Date().toISOString().split('T')[0];
  const todayTotal = auditStore.getDailyTotal(today);
  const dailyPassed = todayTotal + amount <= policy.dailyMax;
  results.push({
    id: 'daily-total-limit',
    label: 'Daily Total Limit',
    passed: dailyPassed,
    reason: dailyPassed ? undefined : `Daily total would be $${(todayTotal + amount).toFixed(2)}, exceeding daily maximum of $${policy.dailyMax.toFixed(2)}. Remaining today: $${(policy.dailyMax - todayTotal).toFixed(2)}.`,
    weight: dailyPassed ? 0.4 : -0.7,
    evidencePaths: ['amount'],
  });

  const approved = results.every((r) => r.passed);
  const reason = approved ? undefined : results.filter((r) => !r.passed).map((r) => r.reason).filter(Boolean).join(' ');

  return { approved, results, reason };
}

// Back-compat wrapper used by tests and existing callers
export async function checkRules(amount: number, recipient?: string): Promise<{ approved: boolean; reason?: string }> {
  const evaln = await evaluateRules(amount, recipient);
  return { approved: evaln.approved, reason: evaln.reason };
}




