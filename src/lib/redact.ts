/**
 * lib/redact.ts — reversible PII masking that runs BEFORE any text reaches a cloud LLM.
 *
 * Isomorphic on purpose (no node: imports): the same code runs in the browser and in route handlers.
 *
 * Pipeline (highest priority wins on overlap):
 *   1. Known terms   – attorney-supplied parties/witnesses (+aliases). Most precise, so highest priority.
 *   2. Regex         – structured identifiers (SSN, card, email, phone, amounts, addresses, dates, custom).
 *   3. Honorific     – "Mr./Dr./Judge X Y" names.
 *   4. wink-nlp      – DATE/MONEY entities + proper-noun runs. The lite model has NO person recognizer,
 *                      so names are heuristic (PROPN runs, minus a legal stop-list). Over-redacting is the
 *                      safe failure mode; allowList / known terms tune it.
 *
 * Replacements are placeholders like [NAME_K7P3QX] stored in a vault (token → original) so LLM output
 * can be rehydrated for the attorney. Dates default to a per-matter day-shift (see dateMode) because
 * timelines need ordering and intervals, which tokens would destroy.
 */
import winkNLP from "wink-nlp";
import type { ItemEntity, ItemToken } from "wink-nlp";
import model from "wink-eng-lite-web-model";
import { z } from "zod";

// ───────────────────────────── Types & settings ─────────────────────────────

export const ENTITY_TYPES = ["NAME", "EMAIL", "PHONE", "SSN", "CARD", "AMOUNT", "DATE", "ADDRESS", "IP", "URL", "CUSTOM"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RedactionSettingsSchema = z.object({
  /** Per-category switch; missing = enabled. */
  enabled: z.partialRecord(z.enum(ENTITY_TYPES), z.boolean()).default({}),
  /** shift = consistent per-matter day offset (keeps order/intervals), mask = [DATE_x] token, keep = leave dates. */
  dateMode: z.enum(["shift", "mask", "keep"]).default("shift"),
  /** Heuristic proper-noun detection via wink-nlp. Turn off if it over-redacts and you rely on known terms. */
  detectNames: z.boolean().default(true),
  /** Terms that must never be redacted (e.g. "Superior Court", the firm's own name). Case-insensitive. */
  allowList: z.array(z.string().min(1).max(200)).max(500).default([]),
  /** Firm-specific regexes (matter numbers, internal IDs). Compiled & length-capped to limit ReDoS exposure. */
  customPatterns: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        pattern: z.string().min(1).max(300),
        flags: z.string().regex(/^[gimsu]*$/).optional(),
      }),
    )
    .max(25)
    .default([]),
});
export type RedactionSettings = z.infer<typeof RedactionSettingsSchema>;
export const DEFAULT_REDACTION_SETTINGS: RedactionSettings = RedactionSettingsSchema.parse({});

export interface KnownTerm {
  value: string;
  type?: EntityType; // default NAME
  aliases?: string[]; // "Smith", "J. Smith" → same token as value
}
export interface VaultEntry {
  value: string;
  type: EntityType;
}
/** Returns the token body (no brackets), e.g. "NAME_7" or "NAME_K7P3QX". `attempt` increments on collision. */
export type TokenStrategy = (type: EntityType, normalized: string, attempt: number) => string;

export interface RedactResult {
  text: string;
  stats: Partial<Record<EntityType, number>>;
  /** Entries minted by THIS call — persist these (additive merge) so restore works later. */
  newEntries: Record<string, VaultEntry>;
}

interface Span {
  start: number;
  end: number;
  type: EntityType;
  priority: number;
  canonical?: string; // known-term canonical value (so aliases share a token)
  shifted?: string; // DATE in shift mode: literal replacement, no token
  passthrough?: boolean; // existing placeholder: protect from re-redaction
}

// ───────────────────────────── Detectors ─────────────────────────────

const PRIORITY = { PASSTHROUGH: 200, KNOWN: 100, CUSTOM: 90, STRONG: 85, REGEX: 80, HONORIFIC: 70, NLP: 50, PROPN: 45 };

const PLACEHOLDER_RX = /\[[A-Z]+_[A-Z0-9]+\]/g;

const MON = "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STREET = "(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Highway|Hwy|Parkway|Pkwy|Terrace|Circle|Cir)";

const REGEX_DETECTORS: { type: EntityType; re: RegExp; priority: number; validate?: (m: string) => boolean }[] = [
  { type: "EMAIL", re: /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi, priority: PRIORITY.STRONG },
  // Formatted SSN, or 9 bare digits when introduced by an SSN label (bare 9-digit runs are too ambiguous otherwise).
  { type: "SSN", re: /(?<!\d)(?!000|666|9\d\d)\d{3}[- ]\d{2}[- ]\d{4}(?!\d)/g, priority: PRIORITY.STRONG },
  { type: "SSN", re: /(?<=(?:SSN|social security(?: number| no\.?| #)?)[:#\s]*)\d{9}(?!\d)/gi, priority: PRIORITY.STRONG },
  { type: "CARD", re: /(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])/g, priority: PRIORITY.STRONG, validate: luhn },
  { type: "URL", re: /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi, priority: PRIORITY.REGEX },
  {
    type: "IP",
    re: /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g,
    priority: PRIORITY.REGEX,
    validate: (m) => m.split(".").every((o) => Number(o) <= 255),
  },
  { type: "PHONE", re: /(?<![\d])(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?![\d])/g, priority: PRIORITY.REGEX },
  {
    type: "AMOUNT",
    re: /(?:(?:US|CA|AU)?\$|€|£|₦|\b(?:USD|EUR|GBP|NGN)\s)\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?(?:million|billion|thousand|bn|k|m)\b)?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:dollars|USD|euros|EUR|pounds|GBP|naira|NGN)\b/gi,
    priority: PRIORITY.REGEX,
  },
  {
    type: "ADDRESS",
    re: new RegExp(`\\b\\d{1,6}\\s+(?:[A-Z][A-Za-z0-9.'-]*\\s+){1,4}${STREET}\\b(?:,?\\s+(?:Suite|Ste|Apt|Unit|#)\\s*[\\w-]+)?`, "g"),
    priority: PRIORITY.REGEX,
  },
  // "Springfield, IL 62704" — city/state/ZIP tails.
  { type: "ADDRESS", re: /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g, priority: PRIORITY.REGEX },
];

function luhn(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

// ───────────────────────────── Dates (shift / unshift) ─────────────────────────────

interface DateHit {
  start: number;
  end: number;
  shift: (deltaDays: number) => string | null;
}

const ord = (d: number) => (d % 100 >= 11 && d % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][d % 10] ?? "th"));
const pad2 = (n: number) => String(n).padStart(2, "0");
const monthIdx = (name: string) => MONTH_ABBR.findIndex((a) => name.toLowerCase().startsWith(a.toLowerCase()));

function addDays(y: number, m: number, d: number, delta: number): { y: number; m: number; d: number } | null {
  const probe = new Date(Date.UTC(y, m - 1, d));
  // Reject impossible dates (Feb 31 etc.) — rolling over would silently corrupt the timeline.
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  const t = new Date(probe.getTime() + delta * 86_400_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Finds every parseable calendar date and returns a closure that re-renders it shifted, in the SAME format. */
function findDates(text: string): DateHit[] {
  const hits: DateHit[] = [];

  for (const m of text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    hits.push({
      start: m.index!,
      end: m.index! + m[0].length,
      shift: (delta) => {
        const r = addDays(y, mo, d, delta);
        return r && `${r.y}-${pad2(r.m)}-${pad2(r.d)}`;
      },
    });
  }

  // US numeric M/D/YYYY (assumed US order — this is a US-litigation tool; dd/mm would be mis-shifted).
  for (const m of text.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?![\d/])/g)) {
    const [mo, d] = [Number(m[1]), Number(m[2])];
    const twoDigit = m[3]!.length === 2;
    const y = twoDigit ? (Number(m[3]) < 70 ? 2000 + Number(m[3]) : 1900 + Number(m[3])) : Number(m[3]);
    const [padM, padD] = [m[1]!.length === 2, m[2]!.length === 2];
    hits.push({
      start: m.index!,
      end: m.index! + m[0].length,
      shift: (delta) => {
        const r = addDays(y, mo, d, delta);
        if (!r) return null;
        const yy = twoDigit ? pad2(r.y % 100) : String(r.y);
        return `${padM ? pad2(r.m) : r.m}/${padD ? pad2(r.d) : r.d}/${yy}`;
      },
    });
  }

  // "March 3rd, 2021"
  for (const m of text.matchAll(new RegExp(`\\b${MON}(\\.)?\\s+(\\d{1,2})(st|nd|rd|th)?(,)?\\s+(\\d{4})\\b`, "gi"))) {
    const mi = monthIdx(m[1]!);
    const [d, y] = [Number(m[3]), Number(m[6])];
    const full = MONTH_FULL[mi]!.toLowerCase() === m[1]!.toLowerCase();
    hits.push({
      start: m.index!,
      end: m.index! + m[0].length,
      shift: (delta) => {
        const r = addDays(y, mi + 1, d, delta);
        if (!r) return null;
        const mon = full ? MONTH_FULL[r.m - 1]! : MONTH_ABBR[r.m - 1]!;
        return `${mon}${m[2] ?? ""} ${r.d}${m[4] ? ord(r.d) : ""}${m[5] ?? ""} ${r.y}`;
      },
    });
  }

  // "3rd of March, 2021" / "3 March 2021"
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(st|nd|rd|th)?\\s+(of\\s+)?${MON}(\\.)?(,)?\\s+(\\d{4})\\b`, "gi"))) {
    const mi = monthIdx(m[4]!);
    const [d, y] = [Number(m[1]), Number(m[7])];
    const full = MONTH_FULL[mi]!.toLowerCase() === m[4]!.toLowerCase();
    hits.push({
      start: m.index!,
      end: m.index! + m[0].length,
      shift: (delta) => {
        const r = addDays(y, mi + 1, d, delta);
        if (!r) return null;
        const mon = full ? MONTH_FULL[r.m - 1]! : MONTH_ABBR[r.m - 1]!;
        return `${r.d}${m[2] ? ord(r.d) : ""} ${m[3] ?? ""}${mon}${m[5] ?? ""}${m[6] ?? ""} ${r.y}`;
      },
    });
  }
  return hits;
}

/** Shift every parseable date in `text` by `delta` days. Used for both redaction (+offset) and restore (−offset). */
export function shiftDatesInText(text: string, delta: number): string {
  if (!delta) return text;
  const hits = findDates(text).sort((a, b) => a.start - b.start);
  let out = "";
  let pos = 0;
  for (const h of hits) {
    if (h.start < pos) continue; // overlapping pattern hit (e.g. same date matched twice) — first wins
    const repl = h.shift(delta);
    if (repl === null) continue;
    out += text.slice(pos, h.start) + repl;
    pos = h.end;
  }
  return out + text.slice(pos);
}

// ───────────────────────────── NLP (wink) ─────────────────────────────

type Nlp = ReturnType<typeof winkNLP>;
let _nlp: Nlp | undefined;
const getNlp = (): Nlp => (_nlp ??= winkNLP(model));

const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "mx", "dr", "prof", "judge", "hon", "sgt", "det", "officer", "atty", "esq", "sir", "madam", "rev", "capt", "lt", "col", "gen"]);
// Capitalised words that are legal boilerplate, not identities. Keeping them visible preserves roles
// ("Plaintiff", "Exhibit 12") the LLM needs for reasoning. Extend via settings.allowList if needed.
const LEGAL_STOP = new Set(
  ("court exhibit exhibits plaintiff plaintiffs defendant defendants petitioner respondent appellant appellee section article paragraph " +
    "agreement contract act rule rules code federal state united states honor counsel witness deposition transcript page line yes no okay " +
    "objection sustained overruled confidential attorney attorneys eyes only inc llc ltd llp corp co company the and of by for to " +
    "direct cross redirect recross examination interrogatory request response complaint motion order judgment verdict jury clerk reporter " +
    "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december " +
    "jan feb mar apr jun jul aug sep sept oct nov dec ssn dob " +
    // Sentence-openers the POS tagger mislabels as proper nouns when capitalised ("Call me at…"). Deliberately excludes
    // words that are also common first names (Will, Mark, Grant, Bill, Rose…) so a real person is never left visible.
    "call please thank thanks tell describe explain show look let did does do was were is are have has had can could would should " +
    "what when where who why how so then now well but if because after before during also any all each there this that these those " +
    "it he she they we you i my your his her their our not never ever sure right correct true false ok").split(" "),
);

const cleanTok = (v: string) => v.replace(/\.+$/, "").toLowerCase();
const isStopTok = (v: string) => {
  const c = cleanTok(v);
  return HONORIFICS.has(c) || LEGAL_STOP.has(c) || /^[a-z]$/.test(c);
};
const NAMEISH = /^\p{Lu}[\p{L}'’.-]*$/u;

function splitForNlp(text: string, max = 120_000): [number, string][] {
  if (text.length <= max) return [[0, text]];
  const parts: [number, string][] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + max, text.length);
    if (end < text.length) {
      const nl = text.lastIndexOf("\n", end);
      if (nl > start + max / 2) end = nl + 1; // cut on a line break so entities aren't sliced mid-sentence
    }
    parts.push([start, text.slice(start, end)]);
    start = end;
  }
  return parts;
}

function nlpSpans(text: string, opts: { names: boolean; dates: boolean; money: boolean; email: boolean; url: boolean }): Span[] {
  const nlp = getNlp();
  const its = nlp.its;
  const spans: Span[] = [];

  for (const [offset, part] of splitForNlp(text)) {
    const doc = nlp.readDoc(part);

    // Token char offsets: tokens + precedingSpaces reproduce the source exactly (verified in tests).
    const starts: number[] = [];
    const ends: number[] = [];
    const pos: string[] = [];
    const vals: string[] = [];
    let cur = 0;
    doc.tokens().each((t: ItemToken) => {
      cur += t.out(its.precedingSpaces).length;
      const v = t.out();
      starts.push(cur);
      cur += v.length;
      ends.push(cur);
      pos.push(t.out(its.pos));
      vals.push(v);
    });

    doc.entities().each((e: ItemEntity) => {
      const type = e.out(its.type) as string;
      const [a, b] = e.out(its.span) as [number, number];
      const start = starts[a];
      const end = ends[b];
      if (start === undefined || end === undefined) return;
      const mapped: EntityType | null =
        type === "DATE" && opts.dates ? "DATE" : type === "MONEY" && opts.money ? "AMOUNT" : type === "EMAIL" && opts.email ? "EMAIL" : type === "URL" && opts.url ? "URL" : null;
      if (mapped) spans.push({ start: offset + start, end: offset + end, type: mapped, priority: PRIORITY.NLP });
    });

    if (!opts.names) continue;
    // Proper-noun runs → NAME. Adjacent PROPN tokens on the same line form one name/org.
    let i = 0;
    while (i < vals.length) {
      if (pos[i] !== "PROPN" || !NAMEISH.test(vals[i]!)) {
        i++;
        continue;
      }
      let j = i;
      while (
        j + 1 < vals.length &&
        pos[j + 1] === "PROPN" &&
        NAMEISH.test(vals[j + 1]!) &&
        /^[ \t]*$/.test(part.slice(ends[j]!, starts[j + 1]!))
      ) {
        j++;
      }
      let a = i;
      let b = j;
      while (a <= b && isStopTok(vals[a]!)) a++; // "Q. Mr. John Smith" → "John Smith"
      while (b >= a && isStopTok(vals[b]!)) b--;
      i = j + 1;
      if (a > b) continue;
      if (a === b) {
        const bare = vals[a]!.replace(/\./g, "");
        if (bare.length < 3) continue;
        if (/^[A-Z]{1,4}$/.test(bare)) continue; // NDA, FBI, LLC… acronyms, not people
        if (bare === bare.toUpperCase() && bare.length > 4) continue; // ALL-CAPS headings (DEPOSITION, APPEARANCES)
      }
      spans.push({ start: offset + starts[a]!, end: offset + ends[b]!, type: "NAME", priority: PRIORITY.PROPN });
    }
  }
  return spans;
}

const HONORIFIC_RX = /(?<=\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Judge|Hon|Sgt|Det|Officer|Atty|MR|MRS|MS|DR|JUDGE)\.?[ \t]+)\p{Lu}[\p{L}'’-]+(?:[ \t]+\p{Lu}[\p{L}'’-]+){0,2}/gu;

// ───────────────────────────── Redactor ─────────────────────────────

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalize(type: EntityType, value: string): string {
  const s = value.normalize("NFKC").trim();
  switch (type) {
    case "EMAIL":
      return s.toLowerCase();
    case "PHONE":
    case "SSN":
    case "CARD":
      return s.replace(/\D/g, "");
    case "AMOUNT":
      return s.toLowerCase().replace(/[\s,]/g, "");
    case "URL":
      return s.toLowerCase().replace(/\/+$/, "");
    default:
      return s.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:]+$/, "");
  }
}

export interface RedactorOptions {
  settings?: Partial<RedactionSettings>;
  known?: KnownTerm[];
  /** Previously minted tokens (from the vault) so restore() works across documents and sessions. */
  entries?: Record<string, VaultEntry>;
  tokenFor?: TokenStrategy;
  /** Days added to every date in shift mode. Must be stable per matter (server derives it from a keyed hash). */
  dateShiftDays?: number;
}

export class Redactor {
  readonly settings: RedactionSettings;
  private known: KnownTerm[];
  private entriesMap = new Map<string, VaultEntry>();
  private byKey = new Map<string, string>();
  private fresh: Record<string, VaultEntry> = {};
  /** Everything minted since the last takeUnsaved() — callers persist this to the vault. */
  private unsaved: Record<string, VaultEntry> = {};
  private strategy: TokenStrategy;
  private shiftDays: number;
  private knownRx: RegExp | null = null;
  private knownLookup = new Map<string, { canonical: string; type: EntityType }>();
  private customRx: { label: string; re: RegExp }[];

  constructor(opts: RedactorOptions = {}) {
    this.settings = RedactionSettingsSchema.parse(opts.settings ?? {});
    this.known = opts.known ?? [];
    this.shiftDays = opts.dateShiftDays ?? 0;
    for (const [token, entry] of Object.entries(opts.entries ?? {})) this.register(token, entry);
    this.strategy = opts.tokenFor ?? this.sequentialStrategy();
    this.customRx = this.settings.customPatterns.flatMap((p) => {
      try {
        const flags = p.flags?.includes("g") ? p.flags : `${p.flags ?? ""}g`;
        return [{ label: p.label, re: new RegExp(p.pattern, flags) }];
      } catch {
        return []; // an invalid user regex must never break redaction of everything else
      }
    });
    this.compileKnown();
  }

  private isOn(t: EntityType) {
    return this.settings.enabled[t] !== false;
  }

  /** Default tokens: NAME_1, NAME_2… continuing after any loaded entries. Server overrides with keyed codes. */
  private sequentialStrategy(): TokenStrategy {
    const counters: Partial<Record<EntityType, number>> = {};
    for (const token of this.entriesMap.keys()) {
      const m = /^([A-Z]+)_(\d+)$/.exec(token);
      if (m) counters[m[1] as EntityType] = Math.max(counters[m[1] as EntityType] ?? 0, Number(m[2]));
    }
    return (type) => `${type}_${(counters[type] = (counters[type] ?? 0) + 1)}`;
  }

  private register(token: string, entry: VaultEntry) {
    this.entriesMap.set(token, entry);
    this.byKey.set(`${entry.type}:${normalize(entry.type, entry.value)}`, token);
  }

  private compileKnown() {
    const variants: string[] = [];
    for (const k of this.known) {
      const type = k.type ?? "NAME";
      for (const v of [k.value, ...(k.aliases ?? [])]) {
        const t = v.trim();
        if (t.length < 2) continue;
        this.knownLookup.set(t.toLowerCase(), { canonical: k.value.trim(), type });
        variants.push(t);
      }
    }
    if (!variants.length) return;
    variants.sort((a, b) => b.length - a.length); // longest first so "John Smith" beats "John"
    this.knownRx = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...new Set(variants)].map(escapeRx).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  }

  /** All spans found in `text` (before overlap resolution). */
  private detect(text: string): Span[] {
    const s = this.settings;
    const spans: Span[] = [];

    for (const m of text.matchAll(PLACEHOLDER_RX)) {
      spans.push({ start: m.index!, end: m.index! + m[0].length, type: "CUSTOM", priority: PRIORITY.PASSTHROUGH, passthrough: true });
    }

    if (this.knownRx) {
      for (const m of text.matchAll(this.knownRx)) {
        const hit = this.knownLookup.get(m[0].toLowerCase());
        if (hit && this.isOn(hit.type)) {
          spans.push({ start: m.index!, end: m.index! + m[0].length, type: hit.type, priority: PRIORITY.KNOWN, canonical: hit.canonical });
        }
      }
    }

    for (const { re, label } of this.customRx) {
      void label;
      if (!this.isOn("CUSTOM")) break;
      for (const m of text.matchAll(re)) {
        if (m[0].length) spans.push({ start: m.index!, end: m.index! + m[0].length, type: "CUSTOM", priority: PRIORITY.CUSTOM });
      }
    }

    for (const d of REGEX_DETECTORS) {
      if (!this.isOn(d.type)) continue;
      for (const m of text.matchAll(d.re)) {
        if (d.validate && !d.validate(m[0])) continue;
        spans.push({ start: m.index!, end: m.index! + m[0].length, type: d.type, priority: d.priority });
      }
    }

    if (this.isOn("DATE") && s.dateMode !== "keep") {
      for (const h of findDates(text)) {
        if (s.dateMode === "shift") {
          const shifted = h.shift(this.shiftDays);
          if (shifted !== null) spans.push({ start: h.start, end: h.end, type: "DATE", priority: PRIORITY.REGEX, shifted });
        } else {
          spans.push({ start: h.start, end: h.end, type: "DATE", priority: PRIORITY.REGEX });
        }
      }
    }

    if (this.isOn("NAME")) {
      for (const m of text.matchAll(HONORIFIC_RX)) {
        // Trim trailing boilerplate that capitalised by accident ("Judge Brown Overruled").
        const words = m[0].split(/[ \t]+/);
        while (words.length && isStopTok(words[words.length - 1]!)) words.pop();
        if (words.length) spans.push({ start: m.index!, end: m.index! + words.join(" ").length, type: "NAME", priority: PRIORITY.HONORIFIC });
      }
    }

    // wink pass: only run when something it can contribute to is enabled (it's the slowest detector).
    const wantNames = s.detectNames && this.isOn("NAME");
    const wantDates = this.isOn("DATE") && s.dateMode !== "keep";
    const wantMoney = this.isOn("AMOUNT");
    const wantEmail = this.isOn("EMAIL");
    const wantUrl = this.isOn("URL");
    if (wantNames || wantDates || wantMoney || wantEmail || wantUrl) {
      for (const sp of nlpSpans(text, { names: wantNames, dates: wantDates, money: wantMoney, email: wantEmail, url: wantUrl })) {
        if (sp.type === "DATE") {
          const val = text.slice(sp.start, sp.end);
          // Relative dates ("last Tuesday") aren't identifying and can't be shifted — leave them readable.
          if (!/\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(val)) continue;
          // A bare year can't be day-shifted; keep it in shift mode so timelines stay usable.
          if (s.dateMode === "shift" && /^\d{4}$/.test(val.trim())) continue;
        }
        spans.push(sp);
      }
    }

    if (!s.allowList.length) return spans;
    // Containment, not equality: the heuristic may emit "Acme" for an allow-listed "Acme Corp.", and a
    // partial match would still redact part of a term the attorney said must stay visible.
    const allowed: [number, number][] = [];
    const allowRx = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...s.allowList].sort((a, b) => b.length - a.length).map(escapeRx).join("|")})(?![\\p{L}\\p{N}])`, "giu");
    for (const m of text.matchAll(allowRx)) allowed.push([m.index!, m.index! + m[0].length]);
    if (!allowed.length) return spans;
    return spans.filter((sp) => sp.passthrough || !allowed.some(([a, b]) => sp.start >= a && sp.end <= b));
  }

  /** Greedy by priority; NAME spans that only partly overlap are trimmed (not dropped) so no fragment leaks. */
  private resolve(spans: Span[], len: number): Span[] {
    const order = [...spans].sort((a, b) => b.priority - a.priority || b.end - b.start - (a.end - a.start) || a.start - b.start);
    const taken = new Uint8Array(len);
    const kept: Span[] = [];
    for (const sp of order) {
      let a = sp.start;
      let overlap = false;
      for (let i = sp.start; i < sp.end; i++) {
        if (taken[i]) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        taken.fill(1, sp.start, sp.end);
        kept.push(sp);
        continue;
      }
      if (sp.type !== "NAME") continue;
      // Salvage uncovered pieces of a NAME span.
      for (let i = sp.start; i <= sp.end; i++) {
        const covered = i === sp.end || taken[i] === 1;
        if (covered) {
          if (i - a >= 2) {
            taken.fill(1, a, i);
            kept.push({ ...sp, start: a, end: i, canonical: undefined });
          }
          a = i + 1;
        }
      }
    }
    return kept.sort((x, y) => x.start - y.start);
  }

  private tokenise(sp: Span, raw: string): string {
    const canonical = sp.canonical ?? raw.trim();
    const norm = normalize(sp.type, canonical);
    const key = `${sp.type}:${norm}`;
    let token = this.byKey.get(key);
    if (!token) {
      for (let attempt = 0; ; attempt++) {
        const candidate = this.strategy(sp.type, norm, attempt);
        if (!this.entriesMap.has(candidate)) {
          token = candidate;
          break;
        }
      }
      const entry = { value: canonical, type: sp.type };
      this.register(token, entry);
      this.fresh[token] = entry;
      this.unsaved[token] = entry;
    }
    return `[${token}]`;
  }

  redact(text: string): RedactResult {
    const kept = this.resolve(this.detect(text), text.length);
    const stats: RedactResult["stats"] = {};
    let out = "";
    let pos = 0;
    for (const sp of kept) {
      out += text.slice(pos, sp.start);
      const raw = text.slice(sp.start, sp.end);
      if (sp.passthrough) out += raw;
      else {
        out += sp.shifted !== undefined ? sp.shifted : this.tokenise(sp, raw);
        stats[sp.type] = (stats[sp.type] ?? 0) + 1;
      }
      pos = sp.end;
    }
    out += text.slice(pos);
    const newEntries = this.fresh;
    this.fresh = {};
    return { text: out, stats, newEntries };
  }

  /**
   * Rehydrate LLM output. Order matters: unshift dates FIRST (LLM text is in the shifted frame), then swap
   * tokens back — otherwise an original date inside a restored value would be shifted a second time.
   */
  restore(text: string): string {
    let out = text;
    if (this.settings.dateMode === "shift" && this.shiftDays) out = shiftDatesInText(out, -this.shiftDays);
    return out.replace(/\[([A-Z]+_[A-Z0-9]+)\]/g, (m, tok: string) => this.entriesMap.get(tok)?.value ?? m);
  }

  /** Deep restore for structured outputs. Only pass LLM-produced content — never system metadata/timestamps. */
  restoreDeep<T>(value: T): T {
    if (typeof value === "string") return this.restore(value) as T;
    if (Array.isArray(value)) return value.map((v) => this.restoreDeep(v)) as T;
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, this.restoreDeep(v)])) as T;
    }
    return value;
  }

  /** Streaming-safe restore: holds back a small tail so placeholders/dates split across chunks still match. */
  stream(): StreamRestorer {
    return new StreamRestorer((t) => this.restore(t));
  }

  /** Safety net before any outbound LLM call: does the payload still contain a raw vault value? */
  containsRaw(text: string): boolean {
    const hay = text.toLowerCase();
    for (const { value, type } of this.entriesMap.values()) {
      if (type === "AMOUNT" || value.length < 4) continue; // short values false-positive constantly
      if (hay.includes(value.toLowerCase())) return true;
    }
    return false;
  }

  /** Idempotent last-resort scrub: swaps any raw vault value for its token (no NLP, no date shifting). */
  scrubKnown(text: string): string {
    let out = text;
    const items = [...this.entriesMap.entries()].filter(([, e]) => e.value.length >= 3).sort((a, b) => b[1].value.length - a[1].value.length);
    for (const [token, e] of items) out = out.replace(new RegExp(escapeRx(e.value), "gi"), `[${token}]`);
    return out;
  }

  entries(): Record<string, VaultEntry> {
    return Object.fromEntries(this.entriesMap);
  }

  /** Entries minted anywhere (documents, filenames, prompts…) that the vault hasn't stored yet. Clears the buffer. */
  takeUnsaved(): Record<string, VaultEntry> {
    const out = this.unsaved;
    this.unsaved = {};
    return out;
  }
  get dateShift() {
    return this.shiftDays;
  }
}

/**
 * Buffers streamed text and only emits the prefix that can no longer change: it never cuts inside an
 * unfinished "[TOKEN]" or inside a date, and always holds back HOLD chars of tail.
 */
export class StreamRestorer {
  private buf = "";
  private static HOLD = 40;
  constructor(private transform: (t: string) => string) {}

  push(chunk: string): string {
    this.buf += chunk;
    let cut = Math.max(0, this.buf.length - StreamRestorer.HOLD);
    if (cut === 0) return "";
    for (const m of this.buf.matchAll(PLACEHOLDER_RX)) if (m.index! < cut && m.index! + m[0].length > cut) cut = m.index!;
    for (const h of findDates(this.buf)) if (h.start < cut && h.end > cut) cut = h.start;
    const open = this.buf.lastIndexOf("[", cut);
    if (open >= 0 && this.buf.indexOf("]", open) === -1) cut = open; // dangling "[NAME_" before the cut
    const ready = this.buf.slice(0, cut);
    this.buf = this.buf.slice(cut);
    return ready ? this.transform(ready) : "";
  }

  flush(): string {
    const rest = this.buf;
    this.buf = "";
    return rest ? this.transform(rest) : "";
  }
}
