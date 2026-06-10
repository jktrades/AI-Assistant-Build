import { google } from "googleapis";
import ExcelJS from "exceljs";
import { completeJSON, parseJsonLoose } from "./llm";
import { supabaseAdmin } from "./supabase";
import { USER_ID, GOALS_SENTINEL_DATE } from "./config";
import { getDailyLog, upsertDailyNotes } from "./dailyLogs";
import { todayKey } from "./dates";
import { FinanceSnapshot } from "./types";

// Finance snapshots persist under the daily_logs notes for the current day, and
// the "latest" pointer is mirrored onto the sentinel row so page loads can read
// it cheaply without scanning dates.

function serviceAccountAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!email || !key) return null;
  return new google.auth.JWT({
    email,
    // Env-stored keys keep literal "\n"; convert back to real newlines.
    key: key.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  });
}

// Download the workbook as XLSX via the Drive API and parse every tab into
// 2D arrays of cell values.
async function dumpWorkbook(): Promise<Record<string, unknown[][]>> {
  const auth = serviceAccountAuth();
  const fileId = process.env.GOOGLE_SHEETS_FINANCE_ID;
  if (!auth || !fileId) throw new Error("finance not configured");

  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.export(
    {
      fileId,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    { responseType: "arraybuffer" }
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.data as ArrayBuffer);

  const tabs: Record<string, unknown[][]> = {};
  wb.eachSheet((sheet) => {
    const rows: unknown[][] = [];
    sheet.eachRow((row) => {
      const values = (row.values as unknown[]).slice(1); // drop 1-based pad
      rows.push(values.map((v) => (v == null ? "" : v)));
    });
    tabs[sheet.name] = rows;
  });
  return tabs;
}

const SYSTEM = `You are a financial analyst extracting a net-worth snapshot from a personal finance spreadsheet dumped as JSON (tab name → 2D array of cells).
Extract a single snapshot. Output JSON ONLY:
{
  "net_worth": number,
  "currency": string,        // ISO code, best guess e.g. "USD"
  "as_of": string,           // ISO date if discoverable, else today
  "categories": [ { "name": string, "amount": number } ],
  "notes": string            // flag any ambiguity for human review, else ""
}
Rules:
- AVOID DOUBLE-COUNTING: if a summary/total tab exists alongside per-category tabs, use ONE source, not both.
- For any time-series / daily-snapshot tab, use ONLY the most recent row.
- Net worth = assets minus liabilities. Liabilities are negative categories.`;

export async function runFinanceSnapshot(): Promise<FinanceSnapshot> {
  const tabs = await dumpWorkbook();
  // Truncate to keep the prompt bounded.
  const dump = JSON.stringify(tabs).slice(0, 60000);

  const res = await completeJSON(SYSTEM, `Workbook:\n${dump}`, 1500);
  const parsed = res ? parseJsonLoose<Partial<FinanceSnapshot>>(res.text) : null;

  const snapshot: FinanceSnapshot = {
    net_worth: Number(parsed?.net_worth) || 0,
    currency: parsed?.currency || "USD",
    as_of: parsed?.as_of || todayKey(),
    categories: Array.isArray(parsed?.categories)
      ? parsed!.categories!.map((c) => ({
          name: String(c.name),
          amount: Number(c.amount) || 0,
        }))
      : [],
    notes: parsed?.notes || "",
    generated_at: new Date().toISOString(),
  };

  // Persist to today's row AND mirror onto the sentinel row as "latest".
  await upsertDailyNotes(todayKey(), (n) => {
    n.finance = snapshot;
    return n;
  });
  await upsertDailyNotes(GOALS_SENTINEL_DATE, (n) => {
    n.finance_latest = snapshot;
    return n;
  });

  await supabaseAdmin().from("audit_log").insert({
    user_id: USER_ID,
    action: "finance.snapshot",
    resource_type: "daily_logs",
    metadata: { net_worth: snapshot.net_worth, currency: snapshot.currency },
  });

  return snapshot;
}

// Cheap read — used by page loads. NEVER triggers the AI pipeline.
export async function getLatestSnapshot(): Promise<FinanceSnapshot | null> {
  const log = await getDailyLog(GOALS_SENTINEL_DATE);
  const snap = log?.notes?.finance_latest as FinanceSnapshot | undefined;
  return snap || null;
}
