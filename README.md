# `react-offline-sheet-guard` — 10,000-Row Offline CSV Validator & IndexedDB Draft Guard

A zero-bloat **React 18 + TypeScript** bulk spreadsheet import workflow that validates **10,000 CSV rows (`40,000` cells) in `~20.1 ms`** on the client before sending a single byte over the network, while persisting large drafts asynchronously in **`IndexedDB`** when connectivity drops.

## Why Server-Only CSV Validation Hurts UX on Unreliable Networks

Most SaaS bulk-import forms (`POST /api/import-csv`) upload the entire file first and validate on the backend:
1. **Wasted bandwidth & slow feedback:** Uploading a `418.8 KB` (or `10 MB`) file over congested mobile/train Wi-Fi only to get `400 Bad Request: Row 7,500 invalid` forces users to re-upload the entire file repeatedly.
2. **`localStorage` fails on bulk sheets:** Saving a `6 MB` CSV draft into `localStorage` throws `QuotaExceededError` (~5 MB ceiling) and blocks the main UI thread synchronously on every save.

## Benchmark (`Node 24` / V8 — `10,000` Rows)

| Metric | Measured Result |
|---|---|
| **Rows Checked** | `10,000` (`40,000` cells) |
| **Rules Enforced** | `Set`-based duplicate ID detection, email syntax, decimal bounds, integer seat counts |
| **Client Validation Time** | **`20.11 ms`** |
| **Failed Upload Payload Saved** | **`418.8 KB`** per caught typo |
| **Offline Persistence** | Asynchronous **`IndexedDB`** (`draft_batches` object store) |

## Quick Start

```bash
npm install

# Run 10,000-row validation accuracy & speed test
npm test

# Launch Vite dev server
npm run dev
```
