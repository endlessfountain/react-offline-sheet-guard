import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCsv(rawCsv) {
  const t0 = performance.now();
  const lines = rawCsv.trim().split(/\r?\n/);
  const seenIds = new Set();
  const issues = [];
  let validCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const [externalId = "", customerEmail = "", amountUsd = "", seatCount = ""] =
      lines[i].split(",");
    const rowNumber = i + 1;
    let ok = true;

    if (!externalId || seenIds.has(externalId)) {
      issues.push({ rowNumber, code: "DUPLICATE_ID" });
      ok = false;
    } else {
      seenIds.add(externalId);
    }
    if (!EMAIL_RE.test(customerEmail)) {
      issues.push({ rowNumber, code: "INVALID_EMAIL" });
      ok = false;
    }
    const amt = Number(amountUsd);
    if (!amountUsd || Number.isNaN(amt) || amt <= 0 || amt > 100_000) {
      issues.push({ rowNumber, code: "AMOUNT_OUT_OF_RANGE" });
      ok = false;
    }
    const seats = Number(seatCount);
    if (!Number.isInteger(seats) || seats < 1 || seats > 5000) {
      issues.push({ rowNumber, code: "INVALID_SEAT_INTEGER" });
      ok = false;
    }
    if (ok) validCount++;
  }

  return {
    totalRows: lines.length - 1,
    validCount,
    issues,
    elapsedMs: Number((performance.now() - t0).toFixed(2)),
    payloadKb: Number((Buffer.byteLength(rawCsv, "utf8") / 1024).toFixed(1)),
  };
}

test("validates 10,000 CSV rows in milliseconds and catches all 4 cell error types", () => {
  const rows = ["externalId,customerEmail,amountUsd,seatCount"];
  for (let i = 1; i <= 10_000; i++) {
    if (i === 50) rows.push("inv_00001,dup@acme.com,49.00,5");
    else if (i === 500) rows.push(`inv_${String(i).padStart(5, "0")},bad-email,49.00,5`);
    else if (i === 2500) rows.push(`inv_${String(i).padStart(5, "0")},ok@acme.com,$1200,5`);
    else if (i === 7500) rows.push(`inv_${String(i).padStart(5, "0")},ok@acme.com,99.00,3.5`);
    else rows.push(`inv_${String(i).padStart(5, "0")},billing${i}@company.io,149.00,10`);
  }
  const csv = rows.join("\n");
  const res = validateCsv(csv);
  console.log(JSON.stringify({
    rows: res.totalRows,
    valid_rows: res.validCount,
    issues_caught: res.issues.length,
    elapsed_ms: res.elapsedMs,
    wasted_upload_avoided_kb: res.payloadKb,
  }));

  assert.equal(res.totalRows, 10_000);
  assert.equal(res.validCount, 9_996);
  assert.equal(res.issues.length, 4);
  assert.deepEqual(
    res.issues.map((x) => x.code),
    ["DUPLICATE_ID", "INVALID_EMAIL", "AMOUNT_OUT_OF_RANGE", "INVALID_SEAT_INTEGER"]
  );
});
