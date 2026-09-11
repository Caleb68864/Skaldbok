// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { db } from './client';

/**
 * Nothing outside `src/storage/` touches a Dexie table without saying so.
 *
 * @remarks
 * `CLAUDE.md` states this as the storage layer's hardest rule — *"UI code and
 * hooks call repositories; they **never** touch the Dexie tables directly"* —
 * and for as long as it has been written down it has been enforced by habit
 * alone. Two consecutive scans measured the drift and both deliberately left it,
 * because it is a cross-cutting refactor rather than a guard. The measurement at
 * the time this file landed: 56 call expressions across 14 files, of which 27
 * read (8 with no `deletedAt` filter on a soft-deletable table), 16 wrote (4
 * bypassing the repository's soft-delete guard), 1 deleted and 12 opened
 * transactions.
 *
 * **The count is not the point.** The point is that a *new* one is invisible to
 * the whole suite: a `db.notes.put(...)` typed into a screen type-checks, lints,
 * and passes every test. This file makes the surface a ratchet — it can shrink
 * without ceremony, and it cannot grow without an entry and a written reason.
 *
 * Three properties, each of which an earlier guard in this repository lacked and
 * paid for:
 *
 * 1. **The permission is per operation, not per file.** `hardDeleteReachability`
 *    learned this the expensive way: allowlisting `SettingsScreen.tsx` for its
 *    whole-database wipe would have let any later `db.notes.delete(...)` in that
 *    file ride along on a decision made about something else (proved — gating the
 *    per-table check behind the file allowlist turned a red probe green). So the
 *    unit here is `<table>:<operation>`, and a file allowed to *read* `kb_nodes`
 *    is not thereby allowed to write them.
 * 2. **The patterns survive a chain broken across lines and a table reached
 *    through a local binding.** `screens/KnowledgeBaseScreen.tsx` used to write
 *    `await db\n  .table('metadata')\n  .where('key')`, which a same-line regex
 *    cannot see — that single wrapped chain hid the whole file from the first
 *    scan's count, and the file it hid turned out to contain a real defect. It
 *    is gone now, which is why the shape is pinned in {@link ACCESS_FORMS}
 *    rather than left to be re-learned. Chains are consumed by a balanced-paren
 *    scanner rather than a regex, so line breaks are irrelevant, and
 *    `const t = db.notes` / `const { notes } = db` resolve to the tables they
 *    name.
 * 3. **An unanalysable case fails loudly.** Every guard gap this repository has
 *    found was a check that passed when it could not resolve what it was looking
 *    at. There is no "could not classify, assume fine" branch here: an unknown
 *    member of `db`, an unrecognised chain method, a namespace import of the
 *    client, or the client passed around as a value are all *reported*, with the
 *    text that could not be classified, so the answer is a decision rather than
 *    a silence.
 *
 * And the property mutation testing cannot check, stated so the next reader does
 * not have to rediscover it: deleting this guard proves it is observed; it says
 * nothing about whether every real direct access arrives in a form it
 * recognises. {@link ACCESS_FORMS} exists for that second question — it
 * enumerates the spellings a direct Dexie access can take in this codebase and
 * asserts each one is classified, including the two that are *not* present in
 * `src` today.
 */

const SRC = join(process.cwd(), 'src');

/** Module specifiers that hand out the live Dexie client. */
const CLIENT_MODULE = /(?:^|\/)storage(?:\/db\/client|\/index|)$/;

/** Table names in the live Dexie schema — the authority on what `db.x` means. */
const TABLE_NAMES = new Set(db.tables.map((t) => t.name));

/**
 * Members of the Dexie instance itself, as opposed to a table.
 *
 * @remarks
 * Anything on `db` that is neither one of these nor a live table name is
 * reported rather than skipped. That is deliberate: a typo, a table added to the
 * schema after this set was written, or a Dexie API nobody here has used yet all
 * arrive as "I do not know what this is", and the honest response to that is a
 * failing test naming the expression.
 */
const DB_MEMBERS = new Set([
  'transaction', 'tables', 'table', 'open', 'close', 'delete', 'on', 'isOpen',
  'verno', 'name', 'version', 'backendDB', 'hasBeenClosed', 'hasFailed', 'ready',
]);

/** Chain methods that only read rows. */
const READ_METHODS = new Set([
  'get', 'bulkGet', 'where', 'equals', 'equalsIgnoreCase', 'above', 'aboveOrEqual',
  'below', 'belowOrEqual', 'between', 'startsWith', 'startsWithIgnoreCase',
  'anyOf', 'noneOf', 'notEqual', 'inAnyRange', 'toArray', 'first', 'last',
  'count', 'each', 'eachKey', 'eachPrimaryKey', 'eachUniqueKey', 'keys',
  'primaryKeys', 'uniqueKeys', 'orderBy', 'toCollection', 'sortBy',
]);

/** Chain methods that create or change rows. */
const WRITE_METHODS = new Set([
  'add', 'put', 'update', 'bulkAdd', 'bulkPut', 'bulkUpdate', 'modify',
]);

/** Chain methods that irreversibly remove rows. */
const DELETE_METHODS = new Set(['delete', 'bulkDelete', 'clear']);

/**
 * Chain methods that refine or plumb a query without changing its severity.
 *
 * @remarks
 * `filter` and `and` are here rather than in {@link READ_METHODS} because they
 * only ever appear after one — they narrow a `Collection`, they do not start
 * one. `catch`/`then`/`finally` are the promise the chain resolves to.
 */
const NEUTRAL_METHODS = new Set([
  'and', 'or', 'filter', 'reverse', 'limit', 'offset', 'distinct', 'until',
  'desc', 'raw', 'clone', 'catch', 'then', 'finally',
]);

const SEVERITY = { ref: 0, read: 1, write: 2, delete: 3 } as const;
type Operation = keyof typeof SEVERITY;

/** Source with comments removed, so prose describing a table access is not one. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|\s)\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length));
}

/** Import statements blanked out, preserving offsets, so the specifiers are not read as uses. */
function blankImports(code: string): string {
  return code.replace(/\bimport\s+[^;]*?from\s*['"][^'"]+['"]\s*;?/g, (m) =>
    m.replace(/[^\n]/g, ' '));
}

/**
 * String and template-literal *text* blanked out, offsets and line breaks kept.
 *
 * @remarks
 * Found by this guard's own first run, which reported
 * `features/kb/NoteReader.tsx:387 — \`db\` used as a value` against a type
 * annotation reading `import('../../storage/db/client').KBEdge`. The `db` it
 * had found was the **directory name inside the module path**. A scanner that
 * reads source as text has to know where the text stops being code, or it
 * reports the contents of every string that happens to contain its subject —
 * and this one is local-first, so the false positive lands on the file names of
 * the storage layer itself. Template substitutions stay live: `${db.notes…}`
 * is code, and blanking it would be the mirror error.
 */
function blankStrings(code: string): string {
  const out = code.split('');
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < out.length; k += 1) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };
  let i = 0;
  while (i < code.length) {
    const ch = code[i]!;
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) j += code[j] === '\\' ? 2 : 1;
      blank(i, Math.min(j + 1, code.length));
      i = j + 1;
      continue;
    }
    if (ch === '`') {
      let j = i + 1;
      let segment = i + 1;
      while (j < code.length && code[j] !== '`') {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === '$' && code[j + 1] === '{') {
          blank(segment, j);
          const end = skipGroup(code, j + 1);
          if (end < 0) { j += 2; continue; }
          j = end;
          segment = j;
          continue;
        }
        j += 1;
      }
      blank(segment, j);
      blank(i, i + 1);
      blank(Math.min(j, code.length), Math.min(j + 1, code.length));
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

interface ImportInfo {
  /** Local names bound to the live `db` value. */
  dbLocals: string[];
  /** Reasons the file cannot be analysed at all. */
  problems: string[];
}

/**
 * Every local name in `code` that refers to the Dexie client.
 *
 * @remarks
 * Three routes in, and the guard has to know all of them or the one it misses is
 * the one that gets used: the module itself, the `src/storage` barrel that
 * re-exports `db`, and a renaming specifier. A namespace import is *not*
 * resolved — it is reported, because `ns.db.notes.put(...)` and
 * `ns['db'].notes.put(...)` are the same access spelled two ways and neither is
 * worth teaching this scanner when no file needs it.
 */
function clientImports(code: string): ImportInfo {
  const dbLocals: string[] = [];
  const problems: string[] = [];
  const named = /\bimport\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  for (const m of code.matchAll(named)) {
    const [, typeOnly, specifiers, path] = m;
    if (typeOnly) continue;
    if (!CLIENT_MODULE.test(path!.replace(/^@/, ''))) continue;
    for (const raw of specifiers!.split(',')) {
      const spec = raw.trim();
      if (!spec || /^type\s/.test(spec)) continue;
      const parts = /^([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?$/.exec(spec);
      if (!parts) continue;
      if (parts[1] === 'db') dbLocals.push(parts[2] ?? parts[1]!);
    }
  }
  const namespace = /\bimport\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s*['"]([^'"]+)['"]/g;
  for (const m of code.matchAll(namespace)) {
    if (CLIENT_MODULE.test(m[2]!.replace(/^@/, ''))) {
      problems.push(`namespace import \`* as ${m[1]}\` of the Dexie client — not analysable`);
    }
  }
  if (/\bfrom\s*['"]dexie['"]/.test(code) && !/\bimport\s+type\b[^;]*\bfrom\s*['"]dexie['"]/.test(code)) {
    problems.push('imports `dexie` directly');
  }
  // A dynamic import of the client in *value* position escapes this scan and is
  // reported. In *type* position — `import('…/client').KBEdge`, which this
  // codebase writes for a type it would otherwise have to import twice — it
  // reaches no table and is not an access. The discriminator is the capitalised
  // member that follows: type names are capitalised here, `db` is not.
  const dynamic = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)(\s*\.\s*[A-Za-z_$][\w$]*)?/g;
  for (const m of code.matchAll(dynamic)) {
    if (!CLIENT_MODULE.test(m[1]!.replace(/^@/, ''))) continue;
    if (m[2] && /\.\s*[A-Z]/.test(m[2])) continue;
    problems.push(`dynamic \`import('${m[1]}')\` of the Dexie client — not analysable`);
  }
  return { dbLocals, problems };
}

/**
 * Consumes a balanced `(...)`, `[...]` or `{...}` group starting at `open`.
 *
 * @returns the index just past the closing bracket, or -1 if it never closes.
 */
function skipGroup(code: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [pairs[code[open]!]!];
  let i = open + 1;
  while (i < code.length && stack.length > 0) {
    const ch = code[i]!;
    if (ch === '\\') { i += 2; continue; }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < code.length) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === quote) { i += 1; break; }
        // A template substitution can hold anything, brackets included.
        if (quote === '`' && code[i] === '$' && code[i + 1] === '{') {
          const end = skipGroup(code, i + 1);
          if (end < 0) return -1;
          i = end;
          continue;
        }
        i += 1;
      }
      continue;
    }
    if (ch in pairs) { stack.push(pairs[ch]!); i += 1; continue; }
    if (ch === stack[stack.length - 1]) { stack.pop(); i += 1; continue; }
    if (ch === ')' || ch === ']' || ch === '}') return -1;
    i += 1;
  }
  return stack.length === 0 ? i : -1;
}

interface ChainLink { name: string; args: string | null }

/**
 * Reads `.name(args).name(args)…` forward from `start`.
 *
 * @remarks
 * A scanner rather than a regex, and that is the whole reason this file sees
 * things the previous count did not. `await db\n  .table('metadata')\n
 * .where('key')\n  .equals(…)\n  .first()` is one expression written over five
 * lines; a regex anchored on `db\.` stops at the first newline and reports
 * nothing, which is exactly how `screens/KnowledgeBaseScreen.tsx` went missing
 * from a survey that claimed to be exhaustive.
 */
function readChain(
  code: string,
  start: number,
  raw: string = code,
): { links: ChainLink[]; unterminated: boolean } {
  const links: ChainLink[] = [];
  let i = start;
  for (;;) {
    while (i < code.length && /\s/.test(code[i]!)) i += 1;
    if (code[i] !== '.') return { links, unterminated: false };
    i += 1;
    while (i < code.length && /\s/.test(code[i]!)) i += 1;
    const name = /^[A-Za-z0-9_$]+/.exec(code.slice(i, i + 64));
    if (!name) return { links, unterminated: true };
    i += name[0].length;
    let probe = i;
    while (probe < code.length && /\s/.test(code[probe]!)) probe += 1;
    if (code[probe] === '(') {
      const end = skipGroup(code, probe);
      if (end < 0) return { links, unterminated: true };
      // Structure comes from the string-blanked copy so brackets inside a
      // literal cannot unbalance the scan; the argument *text* comes from the
      // raw one, because `db.table('notes')` is only resolvable while the
      // literal is still there.
      links.push({ name: name[0], args: raw.slice(probe + 1, end - 1) });
      i = end;
    } else {
      links.push({ name: name[0], args: null });
    }
  }
}

export interface Access {
  /** `<table>:<operation>`, or `db:<member>`. */
  descriptor: string;
  /** 1-based line of the expression. */
  line: number;
  /** Set when the expression could not be classified; the guard reports these. */
  problem?: string;
}

/** The operation a chain performs, taking the most destructive method it names. */
function operationOf(links: ChainLink[]): { op: Operation; unknown: string[] } {
  let op: Operation = 'ref';
  const unknown: string[] = [];
  for (const link of links) {
    if (DELETE_METHODS.has(link.name)) { if (SEVERITY[op] < SEVERITY.delete) op = 'delete'; }
    else if (WRITE_METHODS.has(link.name)) { if (SEVERITY[op] < SEVERITY.write) op = 'write'; }
    else if (READ_METHODS.has(link.name)) { if (SEVERITY[op] < SEVERITY.read) op = 'read'; }
    else if (!NEUTRAL_METHODS.has(link.name)) unknown.push(link.name);
  }
  return { op, unknown };
}

/**
 * Every direct Dexie access in one file.
 *
 * @remarks
 * Exported so the form-enumeration tests can drive it with source text rather
 * than with a file on disk — a probe that has to mutate a real file to ask a
 * question tends to answer a different one.
 */
export function accessesIn(source: string): Access[] {
  const decommented = stripComments(source);
  const code = blankStrings(blankImports(decommented));
  const imports = clientImports(decommented);
  const lineAt = (index: number) => code.slice(0, index).split('\n').length;
  const out: Access[] = [];
  for (const problem of imports.problems) {
    out.push({ descriptor: 'unanalysable', line: 1, problem });
  }
  if (imports.dbLocals.length === 0) return out;

  // Local bindings that stand in for a table: `const t = db.notes` and
  // `const { notes, encounters } = db`. Without these, holding the table in a
  // variable removes every mention of `db` from the access itself.
  const aliases = new Map<string, string>();
  // The `db.<table>` on the right of an alias declaration is the same access the
  // alias then performs; counting both would demand an allowlist entry for a
  // `:ref` that exists only because the table was given a name.
  const aliasDeclarations = new Set<number>();
  for (const local of imports.dbLocals) {
    const bound = new RegExp(
      String.raw`\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=;]+?)?=\s*${local}\s*\.\s*([A-Za-z0-9_$]+)\s*(?=[;\n,)])`,
      'g',
    );
    for (const m of code.matchAll(bound)) {
      aliases.set(m[1]!, m[2]!);
      aliasDeclarations.add(m.index + m[0].lastIndexOf(local));
    }
    const destructured = new RegExp(
      String.raw`\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*${local}\s*(?=[;\n])`,
      'g',
    );
    for (const m of code.matchAll(destructured)) {
      for (const raw of m[1]!.split(',')) {
        const parts = /^\s*([A-Za-z0-9_$]+)(?:\s*:\s*([A-Za-z0-9_$]+))?\s*$/.exec(raw);
        if (parts) aliases.set(parts[2] ?? parts[1]!, parts[1]!);
      }
      // The `db` on the right of a destructure is *resolved*, not escaping —
      // without this it is also reported as "used as a value", which is the
      // over-strict half of getting a refusing guard wrong: a legitimate input
      // refused, on a shape the scanner in fact understands.
      aliasDeclarations.add(m.index + m[0].lastIndexOf(local));
    }
  }

  const record = (table: string, links: ChainLink[], index: number) => {
    const { op, unknown } = operationOf(links);
    if (unknown.length > 0) {
      out.push({
        descriptor: 'unanalysable',
        line: lineAt(index),
        problem: `\`${table}\` reached through unrecognised method(s) ${unknown.map(u => `.${u}()`).join(', ')}`,
      });
      return;
    }
    out.push({ descriptor: `${table}:${op}`, line: lineAt(index) });
  };

  for (const [alias, table] of aliases) {
    const uses = new RegExp(String.raw`(?<![.\w$])${alias}\b`, 'g');
    for (const m of code.matchAll(uses)) {
      const before = code.slice(Math.max(0, m.index - 40), m.index);
      if (/\b(?:const|let|var)\s+$/.test(before) || /\{[^}]*$/.test(before)) continue;
      const { links, unterminated } = readChain(code, m.index + alias.length, decommented);
      if (unterminated) {
        out.push({ descriptor: 'unanalysable', line: lineAt(m.index), problem: `chain from \`${alias}\` does not parse` });
        continue;
      }
      if (links.length === 0) continue;
      record(table, links, m.index);
    }
  }

  for (const local of imports.dbLocals) {
    const uses = new RegExp(String.raw`(?<![.\w$])${local}\b`, 'g');
    for (const m of code.matchAll(uses)) {
      const index = m.index;
      if (aliasDeclarations.has(index)) continue;
      const after = code.slice(index + local.length);
      // `{ db }` / `db:` in an object literal, and `db` handed to a function, are
      // the client escaping analysis entirely. Reported, not skipped.
      if (/^\s*[.]/.test(after) === false) {
        out.push({
          descriptor: 'unanalysable',
          line: lineAt(index),
          problem: `\`${local}\` used as a value rather than accessed — the client escapes this scan`,
        });
        continue;
      }
      const { links, unterminated } = readChain(code, index + local.length, decommented);
      if (unterminated) {
        out.push({ descriptor: 'unanalysable', line: lineAt(index), problem: `chain from \`${local}\` does not parse` });
        continue;
      }
      const head = links[0]!;
      if (head.name === 'table' && head.args !== null) {
        const literal = /^\s*(['"])([A-Za-z0-9_]+)\1\s*$/.exec(head.args);
        const table = literal ? literal[2]! : '<dynamic>';
        record(table, links.slice(1), index);
        continue;
      }
      if (TABLE_NAMES.has(head.name)) {
        record(head.name, links.slice(1), index);
        continue;
      }
      if (DB_MEMBERS.has(head.name)) {
        const { unknown } = operationOf(links.slice(1));
        if (unknown.length > 0 && head.name !== 'transaction' && head.name !== 'tables') {
          out.push({
            descriptor: 'unanalysable',
            line: lineAt(index),
            problem: `\`${local}.${head.name}\` reached through unrecognised method(s) ${unknown.map(u => `.${u}()`).join(', ')}`,
          });
          continue;
        }
        out.push({ descriptor: `db:${head.name}`, line: lineAt(index) });
        continue;
      }
      out.push({
        descriptor: 'unanalysable',
        line: lineAt(index),
        problem: `\`${local}.${head.name}\` is neither a live table nor a known Dexie member`,
      });
    }
  }
  return out;
}

/**
 * Accesses that exist, are **not** endorsed, and are held here so the surface
 * cannot grow while they are being moved.
 *
 * @remarks
 * The distinction from {@link DIRECT_DEXIE_ACCESS} proper is the whole reason
 * this constant is separate rather than merged in with a shrug. An entry above
 * is an argument that the access belongs where it is. An entry *here* is the
 * opposite: it is a defect with a date on it, recorded because a guard that
 * cannot be landed until the last offender is fixed is a guard that never lands,
 * and in the meantime every new offender is free.
 *
 * All of these are the same defect, and it is the one the scan ranked as §12:
 * five sites open `db.transaction('rw', [db.encounters, db.entityLinks], …)`,
 * read the encounter and write participants into it. `useEncounter.ts` is the
 * one that does it correctly — it refuses a tombstoned encounter, and its own
 * comment states the rule *for all of them*: "The repository's `update` refuses
 * this; the participant paths need their own transaction (they touch entityLinks
 * too), so they have to make the same check." The other four do not make it.
 * `BestiaryScreen.tsx` is byte-for-byte the same transaction minus the
 * `if (enc.deletedAt) return;` line, so a participant added to a deleted
 * encounter is written where nobody can see or remove it.
 *
 * The fix was not a guard, it was a repository function all five call —
 * `encounterRepository.addRepresentedParticipants`, plus `endWithSummary` and
 * `entityLinkRepository.reassignNoteToEncounter` for the two writes that were
 * not participant adds. Each entry here was deleted by the commit that moved
 * its site, and is now empty.
 *
 * To add one: same shape as {@link DIRECT_DEXIE_ACCESS}, and start the reason
 * with `DEBT —` so a reader can tell an argument from an IOU at a glance.
 */
const RECORDED_DEBT: Record<string, Record<string, string>> = {
  // Empty, and the emptying is the point. Every entry that stood here was
  // deleted by the commit that moved its site, because the honesty check below
  // fails on a permission for an access the file no longer makes — so the debt
  // could not be paid down quietly and could not be left to rot. Five sites
  // went; `useEncounter.ts`, `addPartyCharactersToEncounter.ts` and
  // `useSessionEncounter.ts` no longer import Dexie at all.
};

/**
 * Every direct Dexie access outside `src/storage/` that is allowed to stay, and
 * why — keyed by file, then by `<table>:<operation>`.
 *
 * @remarks
 * **Read this before adding an entry.** The reason is the entry; the key is only
 * its address. An entry says *this file performs this operation on this table
 * without a repository, and here is the argument that it should*. "It was
 * already there" is not that argument — every one of these was already there.
 *
 * The permission is per operation on purpose. `features/kb/linkSyncEngine.ts`
 * owns the KB projection and reads `kb_nodes` all over; that is not a licence to
 * write `notes`. A file that grows a new operation on a table it is already
 * allowed to touch trips this guard, which is the case the hard-delete guard
 * proved you cannot give away for free.
 */
const DIRECT_DEXIE_ACCESS: Record<string, Record<string, string>> = {
  'features/import/useImportActions.ts': {
    '<dynamic>:read':
      'The import collision preview. It is handed a table *name* out of the bundle and has '
      + 'to look up the local row by id in whichever table that is — a repository method per '
      + 'table would be 26 methods restating one line, and the generic read is the honest '
      + 'shape of a generic question. Deliberately tombstone-blind: a soft-deleted local row '
      + 'still collides on primary key, so hiding it would under-report the conflict.',
  },
  'features/kb/linkSyncEngine.ts': {
    'kb_nodes:read':
      'This file *is* the KB projection\'s storage layer. It owns `kb_nodes`/`kb_edges` '
      + 'end to end — `hardDeleteReachability` already names it the sole GRAPH_MAINTAINER '
      + 'allowed to call the permanent deletes on them — and moving its reads behind '
      + 'repositories it is the only caller of would relocate the code without adding a rule. '
      + 'Reads only: every *write* to the graph here already goes through `kbNodeRepository` '
      + 'and `kbEdgeRepository`, which is why there is no `kb_nodes:write` entry beside this '
      + 'one, and why adding one would have to be argued rather than assumed. The '
      + '`metadata` write that used to sit beside it went the same way, to '
      + '`metadataRepository.set`.',
  },
  'screens/SettingsScreen.tsx': {
    'db:transaction':
      'The "Clear All Data" flow, behind two confirmations and a typed "DELETE". It is '
      + 'defined as "every table", not as a list of them, so it takes `db.tables` and cannot '
      + 'be expressed as repository calls without reintroducing the hand-maintained table '
      + 'list the bundle registry exists to delete. `hardDeleteReachability` allowlists the '
      + 'same operation, per operation, for the same reason.',
    'db:tables':
      'The scope of that transaction and the loop that clears it. Same permission, stated '
      + 'separately because the loop is a separate operation from the transaction.',
  },
  'features/session/useSessionLog.ts': {
    'db:transaction':
      'DEBT, with the honest reason rather than the convenient one. Two transactions over '
      + 'notes + entityLinks + encounters (+ creatureTemplates for the NPC capture): a '
      + 'quick-log entry that must land with its `contains` edge, and an NPC capture that '
      + 'writes a bestiary row and the note describing it together. **"It spans tables" is '
      + 'not the argument** — `encounterRepository.startForSession` spans three and moved '
      + 'behind the boundary in the same sweep that wrote this entry, so that reason was '
      + 'tested and found false. The real reason is narrower: both compose a note, its '
      + 'canonical links and (for one) a creature template across two feature modules, so '
      + 'their home is a storage-layer service that does not exist yet, and inventing one '
      + 'inside a hook carrying buffered writes and end-of-session flush semantics is a '
      + 'larger change than the remaining risk justifies. Neither is tombstone-blind and '
      + 'neither overwrites anything — they only add rows — which is why they were the last '
      + 'thing on the list and why stopping here is a stopping point rather than a gap.',
    'notes:ref': 'Named in a transaction scope array: the quick-log and NPC-capture writes.',
    'entityLinks:ref': 'Named in a transaction scope array: the `contains` edge each one writes.',
    'encounters:ref': 'Named in a transaction scope array: the encounter a logged note belongs to.',
    'creatureTemplates:ref':
      'Named in the NPC-capture transaction\'s scope array — the template and the note that '
      + 'describes it are written in one commit.',
    'notes:write':
      'Inside those transactions: the quick-log note and the NPC note, each of which must '
      + 'land with its `contains` edge or not at all.',
    'creatureTemplates:write':
      'Inside the NPC-capture transaction: the template and its note land together. '
      + '**Also a defect** — it hardcodes a classic-fantasy `{hp, armor, movement}` stats '
      + 'shape, which is a `systemId ===` branch without the string, in the one place '
      + '`engineContract.test.ts` cannot see it.',
  },
  'utils/import/mergeEngine.ts': {
    'db:transaction':
      'The restore transaction. It spans every table in the bundle at once because a '
      + 'partial restore onto a fresh install is unrecoverable — there is no earlier state '
      + 'to fall back on — so the rollback has to cover the whole merge.',
    '<dynamic>:read':
      'The merge is generic over the bundle\'s tables by construction: it walks '
      + '`BUNDLE_PROCESSING_ORDER` and reaches each table by name. Per-table repository '
      + 'calls would reintroduce the hand-maintained list `types/bundleTables.ts` exists to '
      + 'be the only copy of.',
    '<dynamic>:write':
      'Same generic merge, writing the row it just compared — insert, update, and the '
      + 'reparenting write that redirects an imported row at the local campaign.',
    '<dynamic>:ref':
      'The transaction scope, built as `BUNDLE_PROCESSING_ORDER.map(key => db.table(…))` so '
      + 'the tables it locks are the tables the registry says a bundle contains.',
  },
  'test-utils/resetDatabase.ts': {
    'db:tables':
      'Test-only. It sits outside a `.test.ts` file so suites can share it, and nothing in '
      + 'the app imports it; it exists precisely so no test hand-lists tables to clear. '
      + '`hardDeleteReachability` allowlists the same file for the same operation.',
  },
  ...RECORDED_DEBT,
};

/** Every `.ts`/`.tsx` file under `src`, excluding tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Files outside `src/storage` that reach Dexie, mapped to what they do there. */
function surveyOutsideStorage(): Map<string, Access[]> {
  const survey = new Map<string, Access[]>();
  for (const file of sourceFiles(SRC)) {
    const rel = relative(SRC, file).split('\\').join('/');
    if (rel.startsWith('storage/')) continue;
    const accesses = accessesIn(readFileSync(file, 'utf8'));
    if (accesses.length > 0) survey.set(rel, accesses);
  }
  return survey;
}

/**
 * Accesses in one file that no allowlist entry covers.
 *
 * @remarks
 * Factored out so the controls below can hand it synthetic source. A refusing
 * guard needs both directions checked: an input it must reject, and an input it
 * must accept. An over-strict guard is not a safe failure — it is a broken
 * build, and it costs the same day.
 */
export function offendersFor(
  rel: string,
  source: string,
  allowlist: Record<string, Record<string, string>> = DIRECT_DEXIE_ACCESS,
): string[] {
  const allowed = allowlist[rel] ?? {};
  const offenders: string[] = [];
  for (const access of accessesIn(source)) {
    if (access.descriptor === 'unanalysable') {
      offenders.push(`${rel}:${access.line} — cannot classify: ${access.problem}`);
      continue;
    }
    if (!(access.descriptor in allowed)) {
      offenders.push(`${rel}:${access.line} — ${access.descriptor}`);
    }
  }
  return offenders;
}

/**
 * The spellings a direct Dexie access takes, and what each must classify as.
 *
 * @remarks
 * This is the half of the question mutation testing cannot reach. Deleting the
 * guard proves something observes it; it does not prove that every real access
 * arrives in a form the guard recognises. The last three rows are not present in
 * `src` today — they are the shapes the *next* person writes, and the point of
 * listing them is that they are answered now rather than discovered later.
 */
const ACCESS_FORMS: { name: string; source: string; expect: string }[] = [
  {
    name: 'static table accessor',
    source: "import { db } from '../storage/db/client';\nawait db.notes.put(x);",
    expect: 'notes:write',
  },
  {
    name: 'dynamic accessor with a literal name',
    source: "import { db } from '../storage/db/client';\nawait db.table('notes').get(id);",
    expect: 'notes:read',
  },
  {
    name: 'dynamic accessor with a variable name',
    source: "import { db } from '../storage/db/client';\nawait db.table(tableName).put(row);",
    expect: '<dynamic>:write',
  },
  {
    name: 'chain broken across lines',
    source: "import { db } from '../storage/db/client';\nawait db\n  .table('metadata')\n  .where('key')\n  .equals(k)\n  .first();",
    expect: 'metadata:read',
  },
  {
    name: 'table held in a local binding',
    source: "import { db } from '../storage/db/client';\nconst t = db.notes;\nawait t.delete(id);",
    expect: 'notes:delete',
  },
  {
    name: 'table destructured off the client',
    source: "import { db } from '../storage/db/client';\nconst { encounters } = db;\nawait encounters.update(id, patch);",
    expect: 'encounters:write',
  },
  {
    name: 'renaming import specifier',
    source: "import { db as store } from '../storage/db/client';\nawait store.notes.clear();",
    expect: 'notes:delete',
  },
  {
    name: 'imported from the storage barrel',
    source: "import { db } from '../storage';\nawait db.notes.get(id);",
    expect: 'notes:read',
  },
  {
    name: 'collection-level delete behind a where',
    source: "import { db } from '../storage/db/client';\nawait db.notes.where('sessionId').equals(s).delete();",
    expect: 'notes:delete',
  },
  {
    name: 'collection-level modify behind a where',
    source: "import { db } from '../storage/db/client';\nawait db.notes.where('sessionId').equals(s).modify({ x: 1 });",
    expect: 'notes:write',
  },
  {
    name: 'an argument containing braces and a nested call',
    source: "import { db } from '../storage/db/client';\nawait db.notes.filter((n) => { return f(n, ')'); }).toArray();",
    expect: 'notes:read',
  },
  {
    name: 'transaction over several tables',
    source: "import { db } from '../storage/db/client';\nawait db.transaction('rw', [db.notes, db.encounters], run);",
    expect: 'db:transaction',
  },
];

describe('direct Dexie access outside the storage layer', () => {
  const survey = surveyOutsideStorage();

  it('finds the files it is meant to police', () => {
    // Without this the assertions below are vacuous on any refactor that moves,
    // renames or reorganises the client — the failure mode that produced a
    // confident "no direct access anywhere" from a scanner reading nothing.
    //
    // Named files rather than only a count, because the count is *supposed* to
    // fall and a floor that tracks it is a floor that gets lowered without
    // thought. These three are the accesses argued to be permanent: a merge
    // that is generic over tables by construction, a wipe defined as "every
    // table", and the KB projection's own storage layer. If the scanner stops
    // seeing one of those it has stopped working, whatever the total says.
    expect([...survey.keys()]).toContain('utils/import/mergeEngine.ts');
    expect([...survey.keys()]).toContain('screens/SettingsScreen.tsx');
    expect([...survey.keys()]).toContain('features/kb/linkSyncEngine.ts');
    expect(survey.size).toBeGreaterThanOrEqual(4);
  });

  it('recognises every spelling a direct access can take', () => {
    for (const form of ACCESS_FORMS) {
      const found = accessesIn(form.source).map((a) => a.problem ?? a.descriptor);
      expect(found, `form "${form.name}" classified as ${found.join(', ')}`).toContain(form.expect);
    }
  });

  it('refuses an expression it cannot classify rather than passing it', () => {
    // Every guard gap found in this repository was a check that passed when it
    // could not resolve what it was looking at. These four must each produce a
    // *problem*, not a silence.
    const unanalysable = [
      "import { db } from '../storage/db/client';\nawait db.notARealTable.get(id);",
      "import { db } from '../storage/db/client';\nawait db.notes.someNewDexieApi(id);",
      "import * as client from '../storage/db/client';\nawait client.db.notes.get(id);",
      "import { db } from '../storage/db/client';\nregisterStore(db);",
    ];
    for (const source of unanalysable) {
      const problems = accessesIn(source).filter((a) => a.descriptor === 'unanalysable');
      expect(problems.length, `classified silently: ${source}`).toBeGreaterThan(0);
    }
  });

  it('accepts source the rule permits', () => {
    // The control that must be *accepted*. A refusing guard has two ways to be
    // wrong and only one of them shows up as a missing finding; the other breaks
    // the build on legitimate input, which costs the same day and is likelier to
    // be "fixed" by weakening the guard.
    expect(offendersFor('anywhere.ts', "import type { KBNode } from '../storage/db/client';\nconst n: KBNode = x;"))
      .toEqual([]);
    expect(offendersFor('anywhere.ts', "const db = makeThing();\ndb.notes.put(x);")).toEqual([]);
    expect(
      offendersFor(
        'allowed.ts',
        "import { db } from '../storage/db/client';\nawait db.notes.get(id);",
        { 'allowed.ts': { 'notes:read': 'a stated reason long enough to be a reason' } },
      ),
    ).toEqual([]);
  });

  it('reports an access the allowlist does not cover', () => {
    // The control that must *fail*. If this ever returns [], the guard has
    // stopped looking and every green below means nothing.
    expect(
      offendersFor('somewhere.ts', "import { db } from '../storage/db/client';\nawait db.notes.put(x);"),
    ).toEqual(['somewhere.ts:2 — notes:write']);
  });

  it('lets no file outside src/storage reach Dexie without a stated reason', () => {
    const offenders = [...survey].flatMap(([rel]) =>
      offendersFor(rel, readFileSync(join(SRC, rel), 'utf8')));
    expect(
      offenders,
      `${offenders.join('\n  ')}\n\nCLAUDE.md: "UI code and hooks call repositories; they never `
      + 'touch the Dexie tables directly." This is local-first — the row you write here exists '
      + 'in exactly one browser. Add or extend a repository method, which is where the '
      + 'soft-delete filter and the tombstone refusal live. If the access genuinely cannot be '
      + 'expressed as one (a transaction spanning tables, a projection whose storage layer this '
      + 'file is), add it to DIRECT_DEXIE_ACCESS with the argument for why — per operation, not '
      + 'per file.',
    ).toEqual([]);
  });

  it('keeps every allowlist entry honest', () => {
    // A permission for an access that no longer exists is one left lying around
    // for the next person to inherit — the ratchet only tightens if a removed
    // call takes its entry with it.
    for (const [rel, operations] of Object.entries(DIRECT_DEXIE_ACCESS)) {
      const present = new Set((survey.get(rel) ?? []).map((a) => a.descriptor));
      for (const [descriptor, reason] of Object.entries(operations)) {
        expect(present, `${rel} is allowlisted for ${descriptor}, which it no longer does`)
          .toContain(descriptor);
        expect(reason.length, `${rel}:${descriptor} is allowlisted with no stated reason`)
          .toBeGreaterThan(60);
      }
    }
  });
});
