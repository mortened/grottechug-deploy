import { Router } from "express";
import { requireAdmin } from "../auth-middleware.js";
import { prisma } from "../prisma.js";

export const violationsRouter = Router();

// GET /api/violations?semester=&participantId=&sessionId=
violationsRouter.get("/", async (req, res) => {
  const semester = req.query.semester ? String(req.query.semester) : "all";
  const participantId = req.query.participantId ? String(req.query.participantId) : undefined;
  const sessionId = req.query.sessionId ? String(req.query.sessionId) : undefined;

  let sessionFilter: object = {};
  if (sessionId) {
    sessionFilter = { sessionId };
  } else if (semester !== "all") {
    const sessions = await prisma.session.findMany({
      where: { semester },
      select: { id: true }
    });
    sessionFilter = { sessionId: { in: sessions.map(s => s.id) } };
  }

  const violations = await prisma.violation.findMany({
    where: {
      ...sessionFilter,
      ...(participantId ? { participantId } : {})
    },
    include: { participant: true, session: true },
    orderBy: [{ session: { date: "desc" } }, { createdAt: "desc" }]
  });

  res.json(violations.map(v => ({
    id: v.id,
    participantId: v.participantId,
    participantName: v.participant.name,
    isRegular: v.participant.isRegular,
    sessionId: v.sessionId,
    dateISO: v.session.date.toISOString(),
    ruleCode: v.ruleCode,
    crosses: v.crosses,
    reason: v.reason
  })));
});

// POST /api/violations/sync
// Parses all existing attempt notes and creates Violation records. Safe to re-run.
violationsRouter.post("/sync", requireAdmin, async (_req, res) => {
  function parseRuleCodes(note: string | null | undefined): string[] {
    if (!note) return [];
    const codes: string[] = [];
    if (/\bmm\b/i.test(note)) codes.push("MM");
    if (/\bvw\b/i.test(note)) codes.push("VW");
    if (/\bw\b/i.test(note)) codes.push("W");
    if (/\bp\b/i.test(note)) codes.push("P");
    if (/\bdns\b/i.test(note)) codes.push("DNS");
    if (/\b(dnf|tobias)\b/i.test(note)) codes.push("DNF");
    if (/frav[æe]r|\babsence\b/i.test(note)) codes.push("ABSENCE");
    if (/\b(vomit|oppkast)\b/i.test(note)) codes.push("VOMIT");
    if (/\bkpr\b/i.test(note)) codes.push("KPR");
    return codes;
  }

  const attempts = await prisma.attempt.findMany({ where: { note: { not: null } } });
  const rules = await prisma.rule.findMany();
  const ruleMap = Object.fromEntries(rules.map(r => [r.code, r]));
  let synced = 0;

  for (const attempt of attempts) {
    const codes = parseRuleCodes(attempt.note);
    if (codes.length === 0) continue;

    await prisma.violation.deleteMany({
      where: { participantId: attempt.participantId, sessionId: attempt.sessionId }
    });

    for (const code of codes) {
      const rule = ruleMap[code];
      if (rule) {
        await prisma.violation.create({
          data: {
            participantId: attempt.participantId,
            sessionId: attempt.sessionId,
            ruleCode: rule.code,
            crosses: rule.crosses,
            reason: attempt.note
          }
        });
        synced++;
      }
    }
  }

  res.json({ ok: true, synced });
});

// DELETE /api/violations/:id
violationsRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await prisma.violation.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});
