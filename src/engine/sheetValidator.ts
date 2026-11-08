export interface InvoiceRow {
  rowNumber: number;
  externalId: string;
  customerEmail: string;
  amountUsd: string;
  seatCount: string;
}

export interface CellIssue {
  rowNumber: number;
  column: keyof InvoiceRow;
  value: string;
  code: "DUPLICATE_ID" | "INVALID_EMAIL" | "AMOUNT_OUT_OF_RANGE" | "INVALID_SEAT_INTEGER";
  message: string;
}

export interface ValidationReport {
  totalRows: number;
  validRows: InvoiceRow[];
  issues: CellIssue[];
  elapsedMs: number;
  bytesAvoidedOnFailure: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCsvText(rawCsv: string): InvoiceRow[] {
  const lines = rawCsv.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const out: InvoiceRow[] = new Array(lines.length - 1);
  for (let i = 1; i < lines.length; i++) {
    const [externalId = "", customerEmail = "", amountUsd = "", seatCount = ""] =
      lines[i].split(",");
    out[i - 1] = {
      rowNumber: i + 1,
      externalId: externalId.trim(),
      customerEmail: customerEmail.trim(),
      amountUsd: amountUsd.trim(),
      seatCount: seatCount.trim(),
    };
  }
  return out;
}

export function validateInvoiceSheet(rawCsv: string): ValidationReport {
  const t0 = performance.now();
  const rows = parseCsvText(rawCsv);
  const seenIds = new Set<string>();
  const validRows: InvoiceRow[] = [];
  const issues: CellIssue[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let rowClean = true;

    if (!r.externalId || seenIds.has(r.externalId)) {
      issues.push({
        rowNumber: r.rowNumber,
        column: "externalId",
        value: r.externalId,
        code: "DUPLICATE_ID",
        message: r.externalId ? `Duplicate invoice ID '${r.externalId}'` : "Missing invoice ID",
      });
      rowClean = false;
    } else {
      seenIds.add(r.externalId);
    }

    if (!EMAIL_RE.test(r.customerEmail)) {
      issues.push({
        rowNumber: r.rowNumber,
        column: "customerEmail",
        value: r.customerEmail,
        code: "INVALID_EMAIL",
        message: "Malformed billing email address",
      });
      rowClean = false;
    }

    const amt = Number(r.amountUsd);
    if (!r.amountUsd || Number.isNaN(amt) || amt <= 0 || amt > 100_000) {
      issues.push({
        rowNumber: r.rowNumber,
        column: "amountUsd",
        value: r.amountUsd,
        code: "AMOUNT_OUT_OF_RANGE",
        message: "Amount must be a plain decimal between 0.01 and 100000.00",
      });
      rowClean = false;
    }

    const seats = Number(r.seatCount);
    if (!Number.isInteger(seats) || seats < 1 || seats > 5000) {
      issues.push({
        rowNumber: r.rowNumber,
        column: "seatCount",
        value: r.seatCount,
        code: "INVALID_SEAT_INTEGER",
        message: "Seat count must be a whole number between 1 and 5000",
      });
      rowClean = false;
    }

    if (rowClean) {
      validRows.push(r);
    }
  }

  return {
    totalRows: rows.length,
    validRows,
    issues,
    elapsedMs: Number((performance.now() - t0).toFixed(2)),
    bytesAvoidedOnFailure: issues.length > 0 ? new TextEncoder().encode(rawCsv).byteLength : 0,
  };
}
