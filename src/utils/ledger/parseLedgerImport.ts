/**
 * Parsing for ledger JSON — a campaign's opening position and its early
 * transactions, lifted from session notes rather than retyped.
 *
 * @remarks
 * Same posture as the route importer: forgiving about shape, strict about
 * meaning. What differs is that money has a **sign**, and getting it wrong is
 * not a cosmetic problem — an expense recorded as income is a balance that is
 * wrong by twice the figure and looks plausible.
 *
 * So the sign can be given three ways, and any disagreement between them is an
 * error rather than a guess:
 *
 * - `amount` negative — money out.
 * - `direction: "out"` (or `"in"`), with a positive amount.
 * - `in` / `out` as separate fields, the way a cashbook column reads.
 */

/** An account the file asks to exist. */
export interface ParsedLedgerAccount {
  name: string;
  kind: 'asset' | 'liability';
  /** Starting balance, signed. A liability's opening is negative. */
  opening?: number;
  note?: string;
}

/** One entry the file describes. */
export interface ParsedLedgerEntry {
  date: string;
  memo: string;
  /** Signed. Positive is money in. */
  amount: number;
  /** Name of the account it moves, matched to a parsed or existing account. */
  accountName?: string;
  /** Name of the other side, when it is a transfer. */
  counterAccountName?: string;
}

/** Outcome of parsing a ledger file. */
export type LedgerImportResult =
  | {
      ok: true;
      accounts: ParsedLedgerAccount[];
      entries: ParsedLedgerEntry[];
      warnings: string[];
    }
  | { ok: false; error: string };

function asArray(root: unknown, keys: string[]): unknown[] {
  if (!root || typeof root !== 'object') return [];
  const obj = root as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * Reads a money value.
 *
 * @remarks
 * Tolerates the shapes a person or a model actually writes: `"Cr201,335"`,
 * `"201 335"`, `"(1,200)"` for a negative in accounting style. Returns `null`
 * rather than `0` for anything unreadable, because a silent zero is a
 * transaction that vanishes from the balance while still appearing in the list.
 */
export function parseMoney(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value !== 'string') return null;

  let raw = value.trim();
  if (raw === '') return null;

  // Accounting parentheses mean negative.
  let negative = false;
  if (/^\(.*\)$/.test(raw)) {
    negative = true;
    raw = raw.slice(1, -1);
  }
  if (raw.startsWith('-')) {
    negative = !negative;
    raw = raw.slice(1);
  }

  // Strip currency letters, spaces, commas and underscores.
  const digits = raw.replace(/[^0-9.]/g, '');
  if (digits === '' || !/^\d+(\.\d+)?$/.test(digits)) return null;

  const n = Math.trunc(Number(digits));
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Reads an account kind, defaulting to asset. */
function parseKind(value: unknown): 'asset' | 'liability' {
  const t = text(value).toLowerCase();
  if (['liability', 'debt', 'loan', 'owed', 'credit'].includes(t)) return 'liability';
  return 'asset';
}

/** Resolves the sign for one entry from whichever fields it carries. */
function resolveAmount(
  entry: Record<string, unknown>,
  index: number,
  warnings: string[],
): number | null {
  const inValue = parseMoney(entry.in ?? entry.moneyIn ?? entry.credit);
  const outValue = parseMoney(entry.out ?? entry.moneyOut ?? entry.debit);

  if (inValue !== null && outValue !== null) {
    warnings.push(`Entry ${index + 1} has both an in and an out figure and was skipped.`);
    return null;
  }
  if (inValue !== null) return Math.abs(inValue);
  if (outValue !== null) return -Math.abs(outValue);

  const amount = parseMoney(entry.amount ?? entry.value ?? entry.total);
  if (amount === null) return null;

  const direction = text(entry.direction ?? entry.type ?? entry.kind).toLowerCase();
  if (['out', 'expense', 'debit', 'paid', 'payment'].includes(direction)) {
    if (amount < 0) {
      // Both said "out". Agreeing is fine; contradicting is not, and this is
      // the agreeing case.
      return amount;
    }
    return -amount;
  }
  if (['in', 'income', 'credit', 'received', 'receipt'].includes(direction)) {
    if (amount < 0) {
      warnings.push(
        `Entry ${index + 1} is marked as money in but its amount is negative — taken as money out.`,
      );
      return amount;
    }
    return amount;
  }
  return amount;
}

/**
 * Parses ledger JSON.
 *
 * @param text_ - Raw file contents.
 * @param maxEntries - Guard against a runaway file.
 */
export function parseLedgerImport(text_: string, maxEntries = 1000): LedgerImportResult {
  let root: unknown;
  try {
    root = JSON.parse(text_);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  const warnings: string[] = [];

  const rawAccounts = asArray(root, ['accounts', 'ledgerAccounts']);
  const rawEntries = Array.isArray(root)
    ? root
    : asArray(root, ['entries', 'transactions', 'ledger', 'lines']);

  if (rawAccounts.length === 0 && rawEntries.length === 0) {
    return {
      ok: false,
      error:
        'Could not find anything to import. Expected an "accounts" list, an "entries" list, or a bare array of entries.',
    };
  }
  if (rawEntries.length > maxEntries) {
    return { ok: false, error: `That file has ${rawEntries.length} entries — more than ${maxEntries}.` };
  }

  const accounts: ParsedLedgerAccount[] = [];
  const seenAccounts = new Set<string>();
  rawAccounts.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const obj = raw as Record<string, unknown>;
    const name = text(obj.name ?? obj.account ?? obj.title);
    if (name === '') {
      warnings.push(`Account ${index + 1} has no name and was skipped.`);
      return;
    }
    const key = name.toLowerCase();
    if (seenAccounts.has(key)) {
      warnings.push(`Account "${name}" appears more than once; the later one was skipped.`);
      return;
    }
    seenAccounts.add(key);

    const kind = parseKind(obj.kind ?? obj.type);
    const openingRaw = obj.opening ?? obj.openingBalance ?? obj.balance ?? obj.startingBalance;
    let opening = parseMoney(openingRaw);

    // A liability written as a positive "we owe 40,000,000" is the natural way
    // to say it and the opposite of how it is stored. Flip it, and say so.
    if (opening !== null && kind === 'liability' && opening > 0) {
      warnings.push(
        `"${name}" is a debt, so its opening balance of ${opening.toLocaleString()} was recorded as owed.`,
      );
      opening = -opening;
    }

    accounts.push({
      name,
      kind,
      ...(opening !== null ? { opening } : {}),
      ...(text(obj.note) ? { note: text(obj.note) } : {}),
    });
  });

  const entries: ParsedLedgerEntry[] = [];
  rawEntries.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      warnings.push(`Entry ${index + 1} was not readable and was skipped.`);
      return;
    }
    const obj = raw as Record<string, unknown>;
    const amount = resolveAmount(obj, index, warnings);
    if (amount === null) {
      warnings.push(`Entry ${index + 1} has no readable amount and was skipped.`);
      return;
    }
    if (amount === 0) {
      warnings.push(`Entry ${index + 1} is for nothing and was skipped.`);
      return;
    }

    entries.push({
      date: text(obj.date ?? obj.when ?? obj.day),
      memo: text(obj.memo ?? obj.description ?? obj.note ?? obj.what),
      amount,
      ...(text(obj.account ?? obj.accountName)
        ? { accountName: text(obj.account ?? obj.accountName) }
        : {}),
      ...(text(obj.counterAccount ?? obj.to ?? obj.against)
        ? { counterAccountName: text(obj.counterAccount ?? obj.to ?? obj.against) }
        : {}),
    });
  });

  if (accounts.length === 0 && entries.length === 0) {
    // Say *why* rather than just "nothing worked". The warnings collected above
    // are the only explanation the user will get, and discarding them here would
    // leave them staring at a file that is wrong in a way nothing names.
    return {
      ok: false,
      error:
        warnings.length > 0
          ? `Nothing could be imported. ${warnings.join(' ')}`
          : 'Nothing in that file could be read as an account or an entry.',
    };
  }

  return { ok: true, accounts, entries, warnings };
}
