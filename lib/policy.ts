import * as fs from 'fs';
import * as path from 'path';

export interface Policy {
  whitelistedContacts: string[];
  defaultContact?: string;
  perTxnMax: number;
  dailyMax: number;
}

const POLICY_FILE = path.join(process.cwd(), 'policy.json');

function readFile(): Partial<Policy> | undefined {
  try {
    if (!fs.existsSync(POLICY_FILE)) return undefined;
    const raw = fs.readFileSync(POLICY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeFile(p: Policy) {
  fs.writeFileSync(POLICY_FILE, JSON.stringify(p, null, 2));
}

function seedFromEnv(): Policy {
  const envContact = process.env.WHITELISTED_CONTACT || '';
  const contacts = process.env.WHITELISTED_CONTACTS
    ? process.env.WHITELISTED_CONTACTS.split(',').map((s) => s.trim()).filter(Boolean)
    : (envContact ? [envContact] : []);
  const perTxnMax = parseFloat(process.env.PER_TXN_MAX || '0.50');
  const dailyMax = parseFloat(process.env.DAILY_MAX || '3.0');
  return {
    whitelistedContacts: Array.from(new Set(contacts)),
    defaultContact: contacts[0],
    perTxnMax: isFinite(perTxnMax) ? perTxnMax : 0.5,
    dailyMax: isFinite(dailyMax) ? dailyMax : 3.0,
  };
}

let cached: Policy | null = null;

export function getPolicy(): Policy {
  if (cached) return cached;
  const disk = readFile();
  const seeded = seedFromEnv();
  const merged: Policy = {
    whitelistedContacts: disk?.whitelistedContacts?.length
      ? Array.from(new Set(disk.whitelistedContacts))
      : seeded.whitelistedContacts,
    defaultContact: disk?.defaultContact || seeded.defaultContact,
    perTxnMax: typeof disk?.perTxnMax === 'number' ? (disk as Policy).perTxnMax : seeded.perTxnMax,
    dailyMax: typeof disk?.dailyMax === 'number' ? (disk as Policy).dailyMax : seeded.dailyMax,
  };
  if (merged.defaultContact && !merged.whitelistedContacts.includes(merged.defaultContact)) {
    merged.defaultContact = merged.whitelistedContacts[0];
  }
  cached = merged;
  return merged;
}

export function setPolicy(update: Partial<Policy>): Policy {
  const current = getPolicy();
  const next: Policy = {
    whitelistedContacts: update.whitelistedContacts?.length
      ? Array.from(new Set(update.whitelistedContacts.map((s) => s.trim()).filter(Boolean)))
      : current.whitelistedContacts,
    defaultContact: update.defaultContact || current.defaultContact,
    perTxnMax: typeof update.perTxnMax === 'number' ? update.perTxnMax : current.perTxnMax,
    dailyMax: typeof update.dailyMax === 'number' ? update.dailyMax : current.dailyMax,
  };
  if (next.defaultContact && !next.whitelistedContacts.includes(next.defaultContact)) {
    next.defaultContact = next.whitelistedContacts[0];
  }
  cached = next;
  writeFile(next);
  return next;
}

export function pickDefaultRecipient(): string | undefined {
  const p = getPolicy();
  return p.defaultContact || p.whitelistedContacts[0];
}





