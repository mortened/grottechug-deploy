import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { prisma } from "../prisma";

export const importRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

const ALLOWED = new Set(["2026V", "2025H"]);

function normalizeName(raw: unknown): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Fjern parenteser: "Ola (gjest)" -> "Ola"
  s = s.replace(/\s*\(.*?\)\s*/g, " ").trim();
  // Normaliser spaces
  s = s.replace(/\s+/g, " ").trim();
  return s || null;
}

function isGuestsSeparatorCell(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "gjester" || s.startsWith("gjester");
}

function inferYear(sheetName: string): number | undefined {
  const m = sheetName.match(/(20\d{2})/);
  return m ? Number(m[1]) : undefined;
}

function parseDateHeader(cell: unknown, fallbackYear?: number): Date | null {
  // tekst dd.mm eller dd.mm.yyyy
  if (typeof cell === "string") {
    const s = cell.trim();
    const m = s.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = m[3] ? Number(m[3]) : fallbackYear;
    if (!year) return null;
    if (year < 100) year += 2000;
    const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // excel date serial
  if (typeof cell === "number") {
    const d = XLSX.SSF.parse_date_code(cell);
    if (!d) return null;
    const dt = new Date(Date.UTC(d.y, d.m - 1, d.d, 12, 0, 0));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

function toSeconds(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toNote(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function findHeaderRow(rows: unknown[][]): number {
  return rows.findIndex(r => Array.isArray(r) && r.some(c => String(c ?? "").toLowerCase().includes("deltaker")));
}

importRouter.post("/excel", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Missing file" });

  const wb = XLSX.read(req.file.buffer, { type: "buffer" });

  // 1) Faste = kun navn i 2026V før "Gjester"-skillet
  const regularNames = new Set<string>();
  if (wb.SheetNames.includes("2026V")) {
    const ws = wb.Sheets["2026V"];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    const hIdx = findHeaderRow(rows);
    if (hIdx !== -1) {
      const header = (rows[hIdx] as unknown[]).map(c => String(c ?? "").trim());
      const colName = header.findIndex(h => h.toLowerCase() === "deltaker");
      if (colName !== -1) {
        for (let ri = hIdx + 1; ri < rows.length; ri++) {
          const row = rows[ri] as unknown[];
          if (isGuestsSeparatorCell(row[colName])) break; // <-- STOPP ved "Gjester"
          const nm = normalizeName(row[colName]);
          if (nm) regularNames.add(nm);
        }
      }
    }
  }

  let importedAttempts = 0;

  for (const sheetName of wb.SheetNames) {
    if (!ALLOWED.has(sheetName)) continue;

    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    if (!rows.length) continue;

    const hIdx = findHeaderRow(rows);
    if (hIdx === -1) continue;

    const header = (rows[hIdx] as unknown[]).map(c => String(c ?? "").trim());
    const colName = header.findIndex(h => h.toLowerCase() === "deltaker");
    if (colName === -1) continue;

    const yearHint = inferYear(sheetName);

    // find date cols + note col after
    const dateCols: { dateCol: number; noteCol: number | null; date: Date }[] = [];
    for (let ci = 0; ci < header.length; ci++) {
      const date = parseDateHeader(header[ci], yearHint);
      if (!date) continue;

      const nextHeader = String(header[ci + 1] ?? "").toLowerCase();
      const noteCol = nextHeader.includes("anmerk") ? ci + 1 : null;
      dateCols.push({ dateCol: ci, noteCol, date });
    }

    for (let ri = hIdx + 1; ri < rows.length; ri++) {
      const row = rows[ri] as unknown[];
      const name = normalizeName(row[colName]);
      if (!name) continue;

      // NOTE: "Gjester" rad i 2026V skal ikke importeres som person
      if (sheetName === "2026V" && isGuestsSeparatorCell(row[colName])) continue;

      const isRegular = regularNames.has(name);

      const participant = await prisma.participant.upsert({
        where: { name },
        update: { isRegular },
        create: { name, isRegular }
      });

      for (const dc of dateCols) {
        const seconds = toSeconds(row[dc.dateCol]);
        if (seconds == null) continue;

        const note = dc.noteCol != null ? toNote(row[dc.noteCol]) : null;

        const session = await prisma.session.upsert({
          where: { date: dc.date },
          update: { semester: sheetName },
          create: { date: dc.date, semester: sheetName }
        });

        // upsert cell (unique constraint)
        await prisma.attempt.upsert({
          where: { participantId_sessionId: { participantId: participant.id, sessionId: session.id } },
          update: { seconds, note },
          create: { participantId: participant.id, sessionId: session.id, seconds, note }
        });

        importedAttempts++;
      }
    }
  }

  res.json({ ok: true, importedAttempts, regularCount: regularNames.size });
});