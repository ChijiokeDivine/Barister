import { test } from "node:test";
import assert from "node:assert/strict";
import { Redactor, shiftDatesInText } from "../lib/redact";

const SAMPLE = `Q. Mr. John Smith, did you meet Sarah Johnson of Acme Corp. on March 3, 2021 at 123 Main Street? ` +
  `The invoice was $12,500.50 and she emailed john.smith@acme.com. Dr. Priya Patel testified on 2021-04-09 ` +
  `that the meeting happened last Tuesday. SSN 123-45-6789. Call (415) 555-0132. Card 4111 1111 1111 1111.`;

test("redacts structured PII and names, leaves legal boilerplate", () => {
  const r = new Redactor({ settings: { dateMode: "mask" } });
  const { text, stats } = r.redact(SAMPLE);
  for (const leak of ["John Smith", "Sarah Johnson", "Acme", "123 Main Street", "12,500.50", "john.smith@acme.com", "Priya", "Patel", "123-45-6789", "555-0132", "4111", "March 3, 2021", "2021-04-09"]) {
    assert.ok(!text.includes(leak), `leaked: ${leak}\n${text}`);
  }
  assert.ok(text.includes("Mr. [NAME_"), "honorific kept for context");
  assert.ok(text.includes("last Tuesday"), "relative date is not identifying and stays readable");
  assert.ok((stats.NAME ?? 0) >= 4 && stats.SSN === 1 && stats.EMAIL === 1 && stats.CARD === 1);
});

test("same value → same token; restore round-trips exactly (mask mode)", () => {
  const r = new Redactor({ settings: { dateMode: "mask" } });
  const a = r.redact("John Smith met Sarah Johnson. Later John Smith left.").text;
  const names = a.match(/\[NAME_\d+\]/g)!;
  assert.equal(names[0], names[2]);
  assert.notEqual(names[0], names[1]);
  assert.equal(r.restore(a), "John Smith met Sarah Johnson. Later John Smith left.");
});

test("known terms + aliases share one token and beat the heuristic", () => {
  const r = new Redactor({ known: [{ value: "Jonathan Smith", aliases: ["Smith", "J. Smith", "Johnny"] }], settings: { dateMode: "keep" } });
  const { text } = r.redact("Jonathan Smith arrived. Johnny said Smith was late. J. Smith left.");
  const tokens = new Set(text.match(/\[NAME_[^\]]+\]/g));
  assert.equal(tokens.size, 1, text);
  assert.ok(!/Smith|Johnny|Jonathan/.test(text));
  assert.ok(r.restore(text).startsWith("Jonathan Smith arrived. Jonathan Smith said"));
});

test("date shift keeps intervals + format and is exactly reversible", () => {
  const r = new Redactor({ dateShiftDays: 100 });
  const src = "Signed 2021-01-15, paid on 01/20/2021, due March 3rd, 2021 and filed 5 April 2021.";
  const { text } = r.redact(src);
  assert.ok(!/2021-01-15|01\/20\/2021|March 3rd|5 April/.test(text), text);
  assert.match(text, /2021-04-25/); // Jan 15 + 100d
  assert.match(text, /\d{2}\/\d{2}\/2021/); // zero-padding preserved
  assert.equal(r.restore(text), src);
  // interval preserved: Jan 15 → Jan 20 is 5 days
  assert.equal(shiftDatesInText("2021-01-20", 100), "2021-04-30");
});

test("invalid calendar dates are not shifted into nonsense", () => {
  assert.equal(shiftDatesInText("on 2021-02-31", 10), "on 2021-02-31");
});

test("tokens are stable across Redactor instances via entries (vault persistence)", () => {
  const r1 = new Redactor({ settings: { dateMode: "keep" } });
  const out1 = r1.redact("Sarah Johnson called.");
  const r2 = new Redactor({ settings: { dateMode: "keep" }, entries: out1.newEntries });
  const out2 = r2.redact("Then Sarah Johnson hung up. Pat Doe agreed.");
  assert.ok(out2.text.includes(out1.text.match(/\[NAME_\d+\]/)![0]));
  assert.equal(r2.restore(out2.text), "Then Sarah Johnson hung up. Pat Doe agreed.");
  assert.equal(Object.keys(out2.newEntries).length, 1, "only the NEW name is minted");
});

test("custom token strategy is used and collisions retry", () => {
  const seen: number[] = [];
  const r = new Redactor({ settings: { dateMode: "keep" }, tokenFor: (t, _n, attempt) => (seen.push(attempt), `${t}_SAME${attempt}`) });
  const out = r.redact("Alice Walker and Bob Marley spoke.");
  assert.equal(Object.keys(out.newEntries).length, 2);
  assert.ok(seen.includes(1), "second name collided on attempt 0 and retried");
});

test("allowList and per-category toggles", () => {
  const r = new Redactor({ settings: { dateMode: "keep", allowList: ["Acme Corp."], enabled: { EMAIL: false } } });
  const { text } = r.redact("Acme Corp. emailed bob@x.com about Sarah Johnson.");
  assert.ok(text.includes("Acme Corp.") && text.includes("bob@x.com") && !text.includes("Sarah"));
});

test("existing placeholders are protected (no double wrapping)", () => {
  const r = new Redactor({ settings: { dateMode: "keep" } });
  const once = r.redact("Sarah Johnson spoke.").text;
  assert.equal(r.redact(once).text, once);
});

test("custom regex patterns", () => {
  const r = new Redactor({ settings: { dateMode: "keep", customPatterns: [{ label: "matter", pattern: "MTR-\\d{4}-\\d+" }, { label: "bad", pattern: "(" }] } });
  const { text, stats } = r.redact("See MTR-2024-77 for details.");
  assert.ok(!text.includes("MTR-2024-77"));
  assert.equal(stats.CUSTOM, 1);
});

test("restoreDeep rehydrates nested structures incl. ISO dates", () => {
  const r = new Redactor({ dateShiftDays: 40 });
  const red = r.redact("John Smith paid on 2020-05-01.").text;
  const shiftedIso = red.match(/\d{4}-\d{2}-\d{2}/)![0];
  const restored = r.restoreDeep({ date: shiftedIso, who: [red.match(/\[NAME_\d+\]/)![0]] });
  assert.deepEqual(restored, { date: "2020-05-01", who: ["John Smith"] });
});

test("stream restorer yields the same result as whole-string restore for any chunking", () => {
  const r = new Redactor({ dateShiftDays: 77 });
  const red = r.redact("On March 3, 2021 John Smith met Sarah Johnson, and on 2021-04-09 Dr. Patel agreed with John Smith.").text;
  const expected = r.restore(red);
  for (const size of [1, 2, 3, 5, 8, 13, 50]) {
    const s = r.stream();
    let out = "";
    for (let i = 0; i < red.length; i += size) out += s.push(red.slice(i, i + size));
    out += s.flush();
    assert.equal(out, expected, `chunk size ${size}`);
  }
});

test("leak guard: containsRaw / scrubKnown", () => {
  const r = new Redactor({ settings: { dateMode: "keep" } });
  const red = r.redact("Sarah Johnson called John Smith.").text;
  assert.equal(r.containsRaw(red), false);
  assert.equal(r.containsRaw("please ask sarah johnson"), true);
  const scrubbed = r.scrubKnown("please ask sarah johnson about John Smith");
  assert.ok(!/sarah|john/i.test(scrubbed.replace(/\[NAME_\d+\]/g, "")));
});

test("large input is chunked for NLP without losing offsets", () => {
  const r = new Redactor({ settings: { dateMode: "keep" } });
  const line = "Then Sarah Johnson told Bob Marley about it.\n";
  const big = line.repeat(6000); // > 120k chars → multiple NLP windows
  const { text } = r.redact(big);
  assert.ok(!text.includes("Sarah") && !text.includes("Marley"));
  assert.equal(r.restore(text), big);
});

test("sentence-opening verbs are not treated as names; addresses keep the sentence period", () => {
  const r = new Redactor({ settings: { dateMode: "keep" } });
  const { text, newEntries } = r.redact("Call me at noon. Please tell Robert Alvarez we met at 123 Main Street. Thank you.");
  assert.ok(text.includes("Call me") && text.includes("Please tell") && text.includes("Thank you"), text);
  assert.ok(!text.includes("Alvarez"));
  assert.ok(/\]\. Thank/.test(text), `sentence period kept after address: ${text}`);
  assert.ok(Object.values(newEntries).every((e) => !e.value.endsWith(".")), JSON.stringify(newEntries));
});
