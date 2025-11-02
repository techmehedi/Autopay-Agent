import { checkRules } from '@/lib/rules';
import { auditStore } from '@/lib/auditStore';
import * as fs from 'fs';
import * as path from 'path';

// Mock the audit store
jest.mock('@/lib/auditStore', () => {
  let mockEntries: any[] = [];
  return {
    auditStore: {
      addEntry: jest.fn((entry: any) => {
        mockEntries.push(entry);
      }),
      getAllEntries: jest.fn(() => mockEntries),
      getDailyTotal: jest.fn((date: string) => {
        return mockEntries
          .filter((e) => e.timestamp.split('T')[0] === date && e.status === 'approved')
          .reduce((sum, e) => sum + e.amount, 0);
      }),
      clear: () => {
        mockEntries = [];
      },
    },
  };
});

describe('Policy Rules', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      WHITELISTED_CONTACT: '0x1234567890123456789012345678901234567890',
      PER_TXN_MAX: '0.50',
      DAILY_MAX: '3.0',
    };
    (auditStore as any).clear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Recipient validation', () => {
    it('should approve when recipient is whitelisted', async () => {
      const result = await checkRules(0.35, '0x1234567890123456789012345678901234567890');
      expect(result.approved).toBe(true);
    });

    it('should approve when no recipient provided (defaults to whitelisted)', async () => {
      const result = await checkRules(0.35);
      expect(result.approved).toBe(true);
    });

    it('should reject when recipient is not whitelisted', async () => {
      const result = await checkRules(0.35, '0xWRONGADDRESS');
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('not whitelisted');
    });
  });

  describe('Per-transaction limit', () => {
    it('should approve amount within limit', async () => {
      const result = await checkRules(0.35);
      expect(result.approved).toBe(true);
    });

    it('should approve amount at limit', async () => {
      const result = await checkRules(0.50);
      expect(result.approved).toBe(true);
    });

    it('should reject amount over limit', async () => {
      const result = await checkRules(0.51);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('exceeds per-transaction maximum');
    });
  });

  describe('Daily limit', () => {
    it('should approve when within daily limit', async () => {
      // Add some previous transactions
      auditStore.addEntry({
        timestamp: new Date().toISOString(),
        status: 'approved',
        amount: 0.20,
        purpose: 'test',
      });

      const result = await checkRules(0.30);
      expect(result.approved).toBe(true);
    });

    it('should reject when would exceed daily limit', async () => {
      // Add transactions totaling $2.80
      for (let i = 0; i < 5; i++) {
        auditStore.addEntry({
          timestamp: new Date().toISOString(),
          status: 'approved',
          amount: 0.50,
          purpose: 'test',
        });
      }

      const result = await checkRules(0.30);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('exceeding daily maximum');
    });

    it('should reject when exactly at daily limit with new transaction', async () => {
      // Add transactions totaling $3.00
      for (let i = 0; i < 6; i++) {
        auditStore.addEntry({
          timestamp: new Date().toISOString(),
          status: 'approved',
          amount: 0.50,
          purpose: 'test',
        });
      }

      const result = await checkRules(0.01);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('exceeding daily maximum');
    });
  });

  describe('Combined rules', () => {
    it('should reject if any rule fails', async () => {
      // Amount too high
      const result1 = await checkRules(0.60);
      expect(result1.approved).toBe(false);

      // Wrong recipient
      const result2 = await checkRules(0.35, '0xWRONG');
      expect(result2.approved).toBe(false);

      // All rules pass
      const result3 = await checkRules(0.35);
      expect(result3.approved).toBe(true);
    });
  });
});

