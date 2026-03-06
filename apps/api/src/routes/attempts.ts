import { Router } from "express";
import { prisma } from "../prisma";

export const attemptsRouter = Router();

function parseRuleCodes(note: string | null | undefined): string[] {
  if (!note) return [];
  const codes: string[] = [];
  if (/\bmm\b/i.test(note)) codes.push("MM");
  if (/\bvw\b/i.test(note)) codes.push("VW");
  if (/\bw\b/i.test(note)) codes.push("W");   // \bw\b won't match "w" inside "vw"
  if (/\bp\b/i.test(note)) codes.push("P");
  if (/\bdns\b/i.test(note)) codes.push("DNS");
  if (/\b(dnf|tobias)\b/i.test(note)) codes.push("DNF");
  if (/frav[æe]r|\babsence\b/i.test(note)) codes.push("ABSENCE");
  if (/\b(vomit|oppkast)\b/i.test(note)) codes.push("VOMIT");
  if (/\bkpr\b/i.test(note)) codes.push("KPR");
  return codes;
}

// POST /api/attempts/upsert
// body: { participantId, sessionId, seconds, note, violations? }
attemptsRouter.post("/upsert", async (req, res) => {
  const { participantId, sessionId, seconds, note, violations: violationCodes } = req.body as {
    participantId: string;
    sessionId: string;
    seconds: number;
    note?: string | null;
    violations?: string[];
  };

  if (!participantId || !sessionId || typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return res.status(400).json({ error: "Bad input" });
  }

  const cleanNote = note?.trim() ? note.trim() : null;

  const saved = await prisma.attempt.upsert({
    where: { participantId_sessionId: { participantId, sessionId } },
    update: { seconds, note: cleanNote },
    create: { participantId, sessionId, seconds, note: cleanNote }
  });

  // Explicit violations array takes precedence; otherwise parse from note text
  const codes = Array.isArray(violationCodes)
    ? violationCodes.map(c => c.toUpperCase()).filter(c => VALID_CODES.has(c))
    : parseRuleCodes(cleanNote);

  // Sync violations: delete old, recreate from codes
  await prisma.violation.deleteMany({ where: { participantId, sessionId } });

  if (codes.length > 0) {
    const rules = await prisma.rule.findMany({ where: { code: { in: codes } } });
    const ruleMap = Object.fromEntries(rules.map(r => [r.code, r]));

    for (const code of codes) {
      const rule = ruleMap[code];
      if (rule) {
        await prisma.violation.create({
          data: { participantId, sessionId, ruleCode: rule.code, crosses: rule.crosses, reason: cleanNote }
        });
      }
    }
  }

  res.json(saved);
});
