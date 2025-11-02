import { auditStore, AuditEntry } from '@/lib/auditStore';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs to avoid actual file operations in tests
jest.mock('fs', () => {
  let mockData: any = null;
  return {
    existsSync: jest.fn(() => mockData !== null),
    readFileSync: jest.fn(() => JSON.stringify(mockData || [])),
    writeFileSync: jest.fn((file: string, data: string) => {
      mockData = JSON.parse(data);
    }),
  };
});

describe('Audit Store', () => {
  beforeEach(() => {
    // Reset mock data
    (fs.writeFileSync as jest.Mock).mockClear();
    (fs.readFileSync as jest.Mock).mockClear();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  describe('addEntry', () => {
    it('should add an entry to the audit log', () => {
      const entry: AuditEntry = {
        timestamp: '2024-01-01T12:00:00.000Z',
        status: 'approved',
        amount: 0.35,
        purpose: 'coffee',
        recipient: '0x123',
        txId: 'tx-123',
      };

      auditStore.addEntry(entry);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenData = (fs.writeFileSync as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(writtenData);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject(entry);
    });

    it('should append multiple entries', () => {
      const entry1: AuditEntry = {
        timestamp: '2024-01-01T12:00:00.000Z',
        status: 'approved',
        amount: 0.35,
        purpose: 'coffee',
      };
      const entry2: AuditEntry = {
        timestamp: '2024-01-01T13:00:00.000Z',
        status: 'rejected',
        amount: 0.60,
        purpose: 'lunch',
        reason: 'Exceeds limit',
      };

      auditStore.addEntry(entry1);
      auditStore.addEntry(entry2);

      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAllEntries', () => {
    it('should return all entries', () => {
      const mockEntries: AuditEntry[] = [
        {
          timestamp: '2024-01-01T12:00:00.000Z',
          status: 'approved',
          amount: 0.35,
          purpose: 'coffee',
        },
        {
          timestamp: '2024-01-01T13:00:00.000Z',
          status: 'rejected',
          amount: 0.60,
          purpose: 'lunch',
        },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockEntries));

      const entries = auditStore.getAllEntries();
      expect(entries).toHaveLength(2);
      expect(entries).toEqual(mockEntries);
    });

    it('should return empty array when file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const entries = auditStore.getAllEntries();
      expect(entries).toEqual([]);
    });
  });

  describe('getDailyTotal', () => {
    it('should calculate daily total for approved transactions', () => {
      const mockEntries: AuditEntry[] = [
        {
          timestamp: '2024-01-01T12:00:00.000Z',
          status: 'approved',
          amount: 0.35,
          purpose: 'coffee',
        },
        {
          timestamp: '2024-01-01T13:00:00.000Z',
          status: 'approved',
          amount: 0.40,
          purpose: 'snack',
        },
        {
          timestamp: '2024-01-01T14:00:00.000Z',
          status: 'rejected',
          amount: 0.60,
          purpose: 'lunch',
        },
        {
          timestamp: '2024-01-02T12:00:00.000Z',
          status: 'approved',
          amount: 0.30,
          purpose: 'coffee',
        },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockEntries));

      const total = auditStore.getDailyTotal('2024-01-01');
      expect(total).toBe(0.75); // 0.35 + 0.40 (rejected not counted)
    });

    it('should return 0 when no approved transactions for date', () => {
      const mockEntries: AuditEntry[] = [
        {
          timestamp: '2024-01-01T12:00:00.000Z',
          status: 'rejected',
          amount: 0.60,
          purpose: 'lunch',
        },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockEntries));

      const total = auditStore.getDailyTotal('2024-01-01');
      expect(total).toBe(0);
    });
  });
});

